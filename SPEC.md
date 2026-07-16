# Sovereign Docs

**Version:** 0.2\
**Date:** 16 Jul 2026\
**Author:** kasunben\
**Purpose:** Canonical specification for the Sovereign Docs plugin — the single source of truth for its manifest, access model, data model, and build plan.\
**Status:** Draft

---

Sovereign Docs is a **git-backed document workspace** — a place to write, organise,
and share documents, where the documents live in a git repository the user owns
(their "**Sovereign Drive**"). Each document is a Markdown file under a `docs/` tree;
drafts live on the platform until the user publishes them to git; revisions are read
back from git history. It is the personal/shared-document cousin of **Plainwrite**:
the two share the hard machinery (git-provider adapters, vaulted credentials via
`sdk.secrets`/`sdk.connections`, draft-in-DB → publish-to-git, history-as-revisions)
but target different products —
Plainwrite edits content for a **static site**, Sovereign Docs is a **Notion/Google-
Docs-style document workspace** backed by your own repo.

**Design principles:** own your data (it's plain Markdown in your git repo, readable
without Sovereign), minimalism (a clean Markdown-first editor), and reliability
(drafts never lost — they persist on the platform until you publish).

v0.1 targets **GitHub** and a **single repo per user**; the git layer is built around
a **provider adapter** interface (shared with Plainwrite) so GitLab/Gitea and
multiple repos follow without touching core logic. Document-content encryption and
multiple repos are **post-v1**.

The plugin is `type: sovereign` — maintained in a separate external repository.

## Current platform refresh (verified against `claude-sv` 2026-07-16)

**RFC frontmatter `status:` lags reality** — several RFCs below still read
`Draft` in their own doc file even though the surface is fully implemented.
The authoritative signal is the ✅ column in `claude-sv`'s `docs/roadmap.md`,
not the RFC file's status field. Re-verify there before relying on this list.

Implemented and usable now (verified in code, not just doc claims):

- `sdk.directory` (RFC 0041) — real, backed by `requireHost().directory`.
- `sdk.secrets` (RFC 0043) — real per-secret vault (`create`/`get`/`list`/
  `update`/`delete`), not plugin-local crypto.
- **`sdk.connections` (RFC 0049) — real, and directly relevant here.** It is
  a platform-owned "connect an external account" pattern: connection metadata
  records (provider, label, status, `secretRef`, arbitrary `metadata`),
  signed/expiring OAuth state helpers (`createOAuthState`/`verifyOAuthState`),
  a manifest `connections.providers` declaration (callback path, scopes,
  instance-level `config.public`/`config.secrets`), and lifecycle calls
  (`disconnect`/`markUsed`/`markError`). This replaces the git-drive
  connection design originally sketched below (a plugin-local
  `docs_credentials` table + hand-rolled AES-256-GCM) — see
  [Architecture](#architecture-git-layer--db-drafts) and
  [Data model](#data-model). Both the **PAT** (v0.1) and **OAuth** (v0.2)
  connect flows should go through `sdk.connections` + `sdk.secrets` from the
  start, not just the OAuth flow.
- `sdk.storage` (RFC 0044) — real (`put`/`get`/`delete`/`list`/
  `getSignedUrl`), not a stub. Images/assets (D-19) have no platform
  dependency left; use `sdk.storage` unless they intentionally live in the
  user's git repository.
- `sdk.notifications` — real; share alerts use it directly.
- `sdk.data` — real; Docs can expose read-only data contracts (document
  metadata, snippets, revision summaries) for approved consumers.

Still genuinely absent (confirmed no code, RFC status accurately `Draft`):

- Public plugin page routes (RFC 0042) — no middleware exemption from the
  session gate exists yet. Public document pages still fall back to "public
  GitHub repo, link out" until this lands.
- Plugin tool contracts (RFC 0047) — no `sdk.tools` module exists. Assistant/
  automation writes ("create document", "publish draft") wait for this.

## Contents

- [Identity and manifest](#identity-and-manifest)
- [Access control](#access-control)
- [Functional requirements](#functional-requirements)
- [Architecture: git layer + DB drafts](#architecture-git-layer--db-drafts)
- [Public sharing](#public-sharing)
- [Directory structure](#directory-structure)
- [Data model](#data-model)
- [SDK dependencies](#sdk-dependencies)
- [UI](#ui)
- [Build plan](#build-plan)
- [Open questions](#open-questions)
- [Changelog](#changelog)

---

## Identity and manifest

| Property                           | Value                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `id`                               | `fs.sovereign.docs`                                                             |
| `name`                             | `Sovereign Docs`                                                                       |
| `type`                             | `sovereign`                                                                            |
| `runtime`                          | `native`                                                                               |
| `routePrefix`                      | `/docs`                                                                                |
| `shell`                            | `default` (editor view collapses the chrome — consistent with all sibling `type: sovereign` plugins) |
| `adminOnly`                        | omitted (`false`)                                                                      |
| `icon`                             | `icon.svg`                                                                             |
| `permissions`                      | `auth:session`, `db:readWrite`, `mailer:send`, `notifications:send`, `data:provide`, `data:export`, `data:import` |
| `repository`                       | `https://github.com/sovereignfs/sovereign-docs`                                 |
| `compatibility.minPlatformVersion` | `0.19.0`; public document routes additionally need RFC 0042, not yet landed             |

Proposed `manifest.json`:

```json
{
  "schemaVersion": 1,
  "id": "fs.sovereign.docs",
  "name": "Sovereign Docs",
  "version": "0.1.0",
  "description": "A git-backed document workspace.",
  "type": "sovereign",
  "runtime": "native",
  "routePrefix": "/docs",
  "shell": "default",
  "database": {
    "isolation": "isolated",
    "dialect": "sqlite"
  },
  "icon": "icon.svg",
  "permissions": [
    "auth:session",
    "db:readWrite",
    "mailer:send",
    "notifications:send",
    "data:provide",
    "data:export",
    "data:import"
  ],
  "connections": {
    "providers": [
      {
        "id": "github",
        "title": "GitHub",
        "callbackPath": "/connections/github/callback",
        "scopes": ["repo"],
        "config": {
          "public": {
            "clientId": { "label": "Client ID", "env": "GITHUB_CLIENT_ID", "required": true }
          },
          "secrets": {
            "clientSecret": {
              "label": "Client secret",
              "env": "GITHUB_CLIENT_SECRET",
              "required": true
            }
          }
        }
      }
    ]
  },
  "repository": "https://github.com/sovereignfs/sovereign-docs",
  "compatibility": { "minPlatformVersion": "0.19.0" }
}
```

No permission entry is needed for `sdk.connections` or `sdk.secrets` — neither
is in the manifest `permissions` enum; both gate on plugin route context plus
(for connections) the `connections` declaration above. The `config.public`/
`config.secrets` block is only needed once the **OAuth** provider exists
(v0.2, D-16); the v0.1 **PAT** flow still creates a `sdk.connections` record
(provider `github`, no OAuth state involved) but doesn't need the manifest
`connections` block until OAuth callback routing is added.

**Shell choice.** Use `shell: default`, with the editor view collapsing the
chrome (layout/CSS), matching every other `type: sovereign` product plugin
(Ledger, Plainwrite, Tasks, Wallet, Shopper all use `default`). `shell:
minimal` (RFC 0014) is implemented and wired, but is only used by the
`example-minimal` demo plugin in this codebase — not an established product
convention, so Docs doesn't adopt it. The manifest example above declares
`"shell": "default"`.

**Secrets.** Instance-level GitHub OAuth client configuration uses the
`connections.providers[].config.public`/`config.secrets` manifest fields
(resolved from plugin-scoped env vars or Console-managed overrides — see
`getProviderConfig()`). Per-user OAuth/PAT credentials use `sdk.secrets` (the
real vault, RFC 0043) plus `sdk.connections` for the connection record — no
plugin-local crypto is written.

**Plugin capabilities:** `docs:share` (share within the instance),
`docs:publish-public` (create a public share), and `docs:publish-git` (write to
the configured repository) should be declared when capability-gated flows are
implemented.

## Access control

- **Private by default.** A document is visible only to its owner until shared.
- **Instance sharing.** The owner shares a document (or a project) with other users
  on the same instance via a members table — roles `owner` / `editor` / `viewer`.
- **Public sharing.** The owner can make a document publicly viewable via a
  **public-share token** (expiring by default; permanent on explicit opt-in) — see
  [Public sharing](#public-sharing).
- The plugin's authenticated routes inherit the platform session gate (PLT-02/03);
  the **public document route is the one exception** and does its own auth (token or
  session) — which is the platform dependency noted in Open questions.

## Functional requirements

| ID      | Requirement                                                                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOCS-01 | On first use, the user configures their **Sovereign Drive**: point a git repository (private or public) with **write** access, via a **GitHub PAT** or the **GitHub OAuth** browser flow.         |
| DOCS-02 | On configuration, the plugin creates a **`docs/`** directory in the repo; all documents are organised under it. v1 supports **one repo**; multiple repos are post-v1.                             |
| DOCS-03 | The user can create **document projects** and **individual documents**. _Create project_ prompts for a name (→ a folder under `docs/`); _create document_ opens the editor with a blank document. |
| DOCS-04 | The **editor** is minimalistic and **Markdown by default**, with a toggle to a **rich-text** editor over the same Markdown.                                                                       |
| DOCS-05 | **Save** persists a **draft on the platform** (not pushed). **Publish** pushes the document's content to the configured git repository.                                                           |
| DOCS-06 | **Revisions** are presented from the document's **git history** (commits filtered to the file path).                                                                                              |
| DOCS-07 | The **plugin index** lists all documents and document projects owned by (or shared with) the user.                                                                                                |
| DOCS-08 | Opening a document/project opens a **view mode** with a toggle to **edit mode**.                                                                                                                  |
| DOCS-09 | The user can **share** a document with other users **within the instance** (roles owner/editor/viewer).                                                                                           |
| DOCS-10 | A document can be made **public** and shared via a public link — **expiring by default**, **permanent** only when explicitly set.                                                                 |

## Architecture: git layer + DB drafts

**Git via REST, no git binary.** The standalone image ships no `git` binary and
avoids native deps, so all repo operations go through **provider REST APIs** (same
choice as Plainwrite) — no `isomorphic-git`, no server-side clone:

- **List / read** documents — GitHub Contents / Git trees API.
- **Publish** — single file via the Contents API; atomic multi-file via the Git Data
  API (blob → tree → commit → ref) so no partial commit lands.
- **Revisions** — the commits API filtered by the document's path; a revision view
  reads a file at a given commit SHA.
- **Conflict detection** — each draft stores the **base SHA** it was fetched at; if
  the file moved on the remote (edited directly on GitHub) since, publish surfaces a
  conflict instead of clobbering.

**Provider adapter (shared with Plainwrite).** A `GitProvider` interface (file
tree/content, publish single/multi, user info) with a `GitHubProvider`
implementation in v0.1; GitLab/Gitea follow. This adapter layer should be
**extracted into a shared package/library** so Sovereign Docs and Plainwrite
don't duplicate it (Open question). **OAuth URL + code exchange is not part of
this adapter** — the browser-facing OAuth handshake (state, callback,
code-for-token exchange) is handled by `sdk.connections` (see below); the
`GitProvider` only needs an already-resolved access token to call the REST
API.

**Draft lifecycle.**

```
edit → Save  → status: draft      (platform DB only, never lost)
     → Publish → status: published (pushed to git; revision recorded by the commit)
```

Drafts live in the platform DB until published, so a network/API failure never loses
work; publishing is the only operation that touches the remote.

**Credentials & connection lifecycle (v1) — via `sdk.connections` + `sdk.secrets`.**
No plugin-local encryption is written. The per-user git token (PAT in v0.1;
OAuth access/refresh in v0.2) is stored with `sdk.secrets.create({ scope: 'user',
label, value: token, metadata: { provider: 'github' } })`, which returns a
`secretRef` — the plaintext never touches a plugin table. A
`sdk.connections.create({ scope: 'user', provider: 'github', label, secretRef,
metadata: { repoOwner, repoName, branch, basePath } })` record is created
alongside it; this record (not a plugin-local table) is the source of truth
for connection status (`connected` / `needs_reauth` / `error` /
`disconnected`), and drives Account/Console visibility without ever exposing
the token. `metadata` holds display-only identity (`repoOwner`, `repoName`);
plugin-specific settings that change independently of the connection
(`branch`, `base_path`) stay in the plugin-local `docs_drives` row alongside
`connection_id`, so reading them doesn't require a round trip through
`sdk.connections`. Before each git call, the plugin resolves the token with
`sdk.secrets.get(secretRef)`; on API failure, call
`sdk.connections.markError(id, { error, status: 'needs_reauth' })` with a
sanitized message (never the raw provider error body, which may echo the
token). Disconnect calls the GitHub API to revoke first, then
`sdk.connections.disconnect(id)`. This is the platform's general external-
connection pattern (RFC 0049) — Sovereign Docs is a consumer, not the reason
it exists, so no plugin-specific crypto or no-default-secret env key is
needed. **Document-content E2EE remains post-v1** (`sdk.e2ee`, RFC 0060) —
orthogonal to how the git token itself is stored.

## Public sharing

Public access needs care because normal plugin pages remain session-gated. The
target architecture is RFC 0042 public plugin routes, where a plugin declares a
public page prefix and owns token/session authorization for that prefix.

- A **`docs_public_shares` token registry** maps a token → document, with a `mode`
  (`expiring` | `permanent`) and `expires_at`.
- A **public document route** (e.g. a clean `/docs/<project>/<slug>` or `/docs/p/<token>`)
  serves the document as a **read-only HTML page in a clean layout**, doing its **own
  auth in the background** — render publicly if a valid share token resolves,
  otherwise require a session (and 404 to strangers if neither). This is the
  `apiProvider` "plugin owns auth" pattern, applied to a **page** route.
- **Expiry-first:** public shares default to an **expiring** link (a TTL sweep cleans
  them up, so the server doesn't accumulate unbounded public pages); a **permanent**
  public document must be set explicitly, and may be cached.

**Platform dependency (the key one):** the middleware must **exempt the plugin's
public document route from the global session gate** so the plugin can do its own
token-or-session auth. This primitive does not exist for pages yet — it likely
warrants a small platform RFC (generalising the `apiProvider` exemption to a
plugin-declared public page route). Until it lands, public sharing falls back to
"the document's repo/file is public on GitHub" (link out).

## Directory structure

In the repo (the Sovereign Drive):

```
docs/
  <project-slug>/
    <doc-slug>.md
  <doc-slug>.md          # standalone documents (no project)
```

In the plugin (mirrors the other plugin specs): `app/` (index, editor, view, share,
drive-config, and the public route), `db/schema.ts` (the `docs_*` tables),
`app/_lib/` (the `GitProvider` adapter, Markdown↔rich-text — no credential
crypto; that's `sdk.secrets`/`sdk.connections`), and `app/_components/`.

## Data model

All tables are `docs_`-prefixed and carry `tenant_id` (platform rule); composite PKs
on the members/share tables; the owner row is inserted automatically on creation.

| Table                   | Key columns                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs_drives`           | `user_id` (PK in v1, one repo/user), `tenant_id`, `connection_id` (→ `sdk.connections` record), `branch`, `base_path` (`docs`), `created_at`           |
| `docs_projects`         | `id`, `tenant_id`, `owner_id`, `name`, `slug` (folder), `created_at`                                                                                   |
| `docs_documents`        | `id`, `tenant_id`, `owner_id`, `project_id?`, `title`, `slug` (file path), `status` (`draft`\|`published`), `created_at`, `updated_at`                 |
| `docs_drafts`           | `document_id` + `user_id` (PK), `tenant_id`, `content` (Markdown), `base_sha` (conflict), `updated_at`                                                 |
| `docs_document_members` | (`document_id`, `user_id`) PK, `tenant_id`, `role` (`owner`\|`editor`\|`viewer`), `invited_by?`, `joined_at`                                           |
| `docs_public_shares`    | `id`, `tenant_id`, `document_id`, `token` (unique), `mode` (`expiring`\|`permanent`), `expires_at?`, `created_by`, `created_at`                        |

(Project-level sharing may reuse a `docs_project_members` table on the same pattern;
v0.1 can scope sharing to documents and add projects later.)

## SDK dependencies

| SDK surface         | Used for                                           | Status                        |
| ------------------- | -------------------------------------------------- | ------------------------------ |
| `sdk.auth`          | Current user session                               | Stable                         |
| `sdk.directory`     | Share target picker                                | Implemented (RFC 0041 doc: Draft) |
| `sdk.db`            | `docs_*` draft, metadata, and share tables         | Stable                         |
| `sdk.mailer`        | Share notification emails                          | Stable                         |
| `sdk.notifications` | In-app/push share alerts                           | Implemented                    |
| `sdk.data`          | Read-only document/snippet contracts               | Implemented                    |
| `sdk.storage`       | Optional images/assets outside git                 | Implemented (RFC 0044)         |
| `sdk.secrets`       | Per-user Git token storage (vault)                 | Implemented (RFC 0043 doc: Draft) |
| `sdk.connections`   | Git connection metadata, OAuth state, lifecycle    | Implemented (RFC 0049 doc: Draft) |
| `sdk.tools`         | Future confirmed create/publish actions            | Not implemented (RFC 0047)     |

### Data contracts

Candidate read-only contracts:

| Contract                 | Version | Shape                                             |
| ------------------------ | ------- | ------------------------------------------------- |
| `docs.documents`         | 1       | Documents visible to the current user.            |
| `docs.snippets`          | 1       | Searchable excerpts with document metadata.       |
| `docs.revisions`         | 1       | Revision metadata for selected documents.         |

### Portability and deletion

Export includes document metadata, drafts, shares, public-share records, and
connection metadata. Git credentials are not exported. Import restores drafts
and metadata additively; remote git contents are not recreated unless the user
reconnects a drive. User deletion removes drafts, disconnects the user's
`sdk.connections` record (which removes the linked `sdk.secrets` vault entry),
revokes public shares created by the user, and transfers or archives shared
documents according to membership.

## UI

- **Index** — projects + documents owned by / shared with the user; create-project
  (name prompt) and create-document actions.
- **Editor** — minimalistic Markdown by default with a **rich-text toggle**; Save /
  Publish; a **revisions panel** (git history for the file); chrome collapsed.
- **Viewer** — clean read-only render with an **edit toggle** (when permitted); the
  public route reuses this read-only layout.
- **Share dialog** — pick instance users + role; a **public toggle** with
  expiring/permanent.
- **Drive config** — first-run repo connection (PAT or GitHub OAuth), backed by
  `sdk.connections` + `sdk.secrets`; shows connection status and a disconnect
  action, never the token.

Net-new UI primitives: the Markdown/rich-text editor and the revision/diff view (not
in `@sovereignfs/ui` today).

## Build plan

- **v0.1** — drive config (GitHub **PAT** via `sdk.secrets` + `sdk.connections`),
  create project/document, the Markdown editor, **Save (draft)** + **Publish (git)**,
  the index, view/edit toggle, **revisions** from git history; **single repo**;
  **private + instance sharing**.
- **v0.2** — **rich-text toggle**; **GitHub OAuth** (via `sdk.connections`
  OAuth-state helpers + the manifest `connections.providers` declaration);
  **public sharing** via the token registry (**expiring** links) — gated on the
  public-page platform primitive.
- **v0.3** — **permanent** public docs + caching; **conflict resolution** on external
  edits; **images/assets** in documents.
- **v1.0** — stable.
- **Post-v1** — **multiple repos**; **document-content E2EE** (client-side key
  management via `sdk.e2ee`, RFC 0060 — implemented; Docs would still build
  the per-document encrypt/decrypt on top of it); GitLab/Gitea providers.

## Open questions

1. **Public-page platform primitive.** Public document routes depend on RFC 0042
   (still Draft, no code). Until then, public = public GitHub repo.
2. **Image / asset storage.** Git blobs in the repo now, vs `sdk.storage`
   (implemented, RFC 0044); decide how relative image paths resolve in both
   editor and public render.
3. **Markdown ↔ rich-text fidelity.** Round-tripping without mangling raw Markdown
   (frontmatter, code blocks, tables).
4. **External-edit conflict policy.** Beyond detection via base SHA — overwrite,
   branch, or merge?
5. **Permanent-public performance.** Cache/pre-render vs render-on-request.
6. **Shared git layer.** Extracting the `GitProvider` REST adapter into a package
   shared with Plainwrite (no credential crypto to extract — that's platform-owned
   via `sdk.secrets`/`sdk.connections`).
7. **Multi-repo** (post-v1) — drive selection per project/document.

Resolved since the initial draft (no longer open): user-directory SDK
(`sdk.directory` is implemented — sharing is unblocked); secret vault
migration (v0.1 builds directly on the real `sdk.secrets`/`sdk.connections`
vault from the start, so there's nothing to migrate).

## Changelog

| Version | Date         | Change                                                                                                                                                                                                                                                                                                                                    |
| ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.2     | 16 Jul 2026  | Re-verified against `claude-sv` platform code (not just RFC status fields). Replaced plugin-local credential encryption with `sdk.connections` (RFC 0049) + `sdk.secrets` (RFC 0043) — both implemented; dropped `docs_credentials` and slimmed `docs_drives`. Corrected `sdk.storage` from "stub" to implemented (RFC 0044). Corrected `shell` from `default`+collapse to `minimal` (RFC 0014, wired) — **then reverted**: `plugins/ledger` was misread as using `shell: minimal`; it actually uses `default`, like every other product plugin (`minimal` is only used by the `example-minimal` demo). Settled back on `shell: default`. Fixed `minPlatformVersion` mismatch (0.19.0). Corrected the post-v1 E2EE reference from a hypothetical `sdk.crypto` to the already-implemented `sdk.e2ee` (RFC 0060). Resolved two open questions (user-directory SDK, secret-vault migration). Added `data:export`/`data:import` to `permissions` — required for D-12's portability handlers; without them the runtime silently skips unregistered/un-permitted export/import resolvers. |
| 0.1     | Jun 2026     | Initial proposal.                                                                                                                                                                                                                                                                                                                          |
