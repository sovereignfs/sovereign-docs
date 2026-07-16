# Sovereign Docs — Roadmap

Chronological, dependency-ordered task queue for building the Sovereign Docs
plugin. Each task is scoped to **one branch = one PR**, small enough for an AI
agent to pick up with minimal supervision. Full requirements: [SPEC.md](SPEC.md).

## How to read this file

- **`[PLATFORM]`** tasks change the main **`claude-sv`** monorepo
  (`/Users/heimdallr/Dev/kasunben/sovereignfs/claude-sv`). They follow that
  repo's own `CLAUDE.md` / `docs/development-workflow.md` conventions
  (branch naming, version bumps, `docs/roadmap.md` + `docs/epics/` updates,
  draft PRs). **Do these in the `claude-sv` repo, not here.**
- **`[PLUGIN]`** tasks change **this repo** (`sovereign-docs.local`, which
  becomes the public `sovereign-docs` repo). Conventions for this repo are
  bootstrapped in D-00 below — follow whatever it establishes.
- Tasks are **sequenced** — don't start a task whose `Depends on` isn't ✅,
  unless tagged `[parallel]`.
- Status: `⬜ not started` / `🟨 in progress` / `✅ done`.
- **Platform-gap-first:** Phase 0 confirms/closes what's missing in the
  platform *before* plugin work begins, so the plugin is never built against
  a moving or absent primitive.

---

## Phase 0 — Platform readiness check `[PLATFORM]`

As of the last audit (2026-07-16, re-verified against `claude-sv` code — not
just RFC frontmatter, which lags reality; the authoritative signal is the ✅
column in `claude-sv`'s `docs/roadmap.md`), the platform already provides
everything v0.1 needs, and more than the previous audit found:

- `sdk.directory`, `sdk.secrets` (real per-secret vault — **supersedes**
  SPEC.md's original "plugin-local AES-GCM fallback" note), `sdk.data`,
  `sdk.notifications`, `sdk.storage` (RFC 0044 — **implemented**, not a stub;
  the previous audit's "still a stub" note was wrong). `shell: minimal` (RFC
  0014) is also implemented and wired, but **`shell: default` is the right
  choice for Docs** — a prior pass here wrongly claimed `plugins/ledger` uses
  `minimal`; it actually uses `default`, same as every other product plugin
  (Plainwrite, Tasks, Wallet, Shopper). `minimal` is only used by the
  `example-minimal` demo plugin, not an established convention.
- **`sdk.connections` (RFC 0049) is implemented** and wasn't in the previous
  audit at all. It's a platform-owned "connect an external account" pattern
  (connection metadata, OAuth state helpers, provider config, disconnect/
  markError/markUsed lifecycle) that directly replaces the git-drive
  connection design SPEC.md originally sketched as a plugin-local
  `docs_credentials` table + hand-rolled encryption. **D-02 and D-04 below are
  updated to build on it from the start** — see SPEC.md's "Current platform
  refresh" and "Credentials & connection lifecycle" sections.
- Still genuinely absent, confirmed by reading the code (not just the RFC
  file): RFC 0042 (public plugin routes — no middleware exemption exists) and
  RFC 0047 (`sdk.tools` — no such module exists).

**No platform work blocks starting Phase 1.**

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-00 | **[PLUGIN]** Bootstrap this repo: `package.json`, `tsconfig` (extend `@sovereignfs/tsconfig`), ESLint/Prettier config matching `claude-sv` conventions, `manifest.json` skeleton (id `fs.sovereign.docs`, `type: sovereign`, `runtime: native`, `shell: default`), README pointing to SPEC.md + this roadmap. CI workflow deliberately deferred — see Deferred section. | — | ✅ |
| D-01 | **[PLATFORM]** Re-verify Phase 0 findings are still current (`sdk.connections`/`sdk.storage` still implemented, RFC 0042 still Draft/no code, `sdk.tools` still absent) immediately before starting Phase 2 and Phase 3 — SDK surfaces can change between now and then. No code change unless something regressed. | — | ⬜ |

---

## Phase 1 — Plugin v0.1 core (private + instance sharing, no platform gaps) `[PLUGIN]`

Everything in this phase runs entirely on primitives that already exist.

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-02 | DB schema: `docs_drives` (slim — `user_id`, `tenant_id`, `connection_id`, `branch`, `base_path`, `created_at`; no `docs_credentials` table, see SPEC), `docs_projects`, `docs_documents`, `docs_drafts`, `docs_document_members` (all `tenant_id`-scoped per SPEC data model). Migration + Drizzle schema file. | D-00 | ⬜ |
| D-03 | Git provider adapter: `GitProvider` interface + `GitHubProvider` implementation (list/read via Contents/Trees API, publish single file, publish multi-file via Git Data API, commits API for revisions). Takes an already-resolved access token — no OAuth code in the adapter itself (that's D-04/D-16, via `sdk.connections`). Port the pattern from `sovereign-plainwrite`'s `_lib/git-providers.ts` — do not wait for a shared package (see Deferred D-16-shared). | D-02 | ⬜ |
| D-04 | Drive config UI + server actions: connect a repo via **GitHub PAT**; store the token via `sdk.secrets.create({ scope: 'user', ... })`, create a `sdk.connections.create({ scope: 'user', provider: 'github', secretRef, metadata: { repoOwner, repoName } })` record, create `docs/` dir on connect, `docs_drives` row insert (`connection_id` + `branch`/`base_path`). Show connection status + a disconnect action (calls GitHub revoke, then `sdk.connections.disconnect()`). `[parallel]`-safe with D-05 once D-03 lands. | D-03 | ⬜ |
| D-05 | Create project / create document flows: name prompt → slug, `docs_projects` / `docs_documents` rows, owner membership row auto-inserted. | D-02 | ⬜ |
| D-06 | Markdown editor (minimalistic, Markdown-first) + **Save** (writes `docs_drafts`, never touches git). | D-05 | ⬜ |
| D-07 | **Publish** flow: push draft content via git adapter, record `base_sha`, flip `docs_documents.status` to `published`, conflict check against stored `base_sha`. | D-03, D-06 | ⬜ |
| D-08 | Revisions panel: commits API filtered by file path, render a revision at a given SHA. | D-07 | ⬜ |
| D-09 | Plugin index: projects + documents owned by / shared with the user. | D-05 | ⬜ |
| D-10 | Viewer (read-only render) + edit-mode toggle (permission-gated). | D-06 | ⬜ |
| D-11 | Instance sharing: share dialog using `sdk.directory` for the user picker, `docs_document_members` roles (owner/editor/viewer), `sdk.mailer` + `sdk.notifications` share alerts. | D-09, `sdk.directory` (ready) | ⬜ |
| D-12 | Portability: export (metadata, drafts, shares, connection metadata — no credentials) and import (additive, no remote recreation) per SPEC "Portability and deletion"; user-deletion handler (revoke shares, transfer/archive per membership). | D-02..D-11 | ⬜ |
| D-13 | v0.1 hardening pass: tenant-scoping test sweep across all `docs_*` tables, error-state UI (failed publish, expired/revoked GitHub token surfaced via `sdk.connections.markError` → `needs_reauth`/`error` status). No plugin-local secret key to check — token storage is platform-owned (`sdk.secrets`). | D-12 | ⬜ |

**v0.1 is feature-complete after D-13.**

---

## Phase 2 — Platform prerequisite for public sharing `[PLATFORM]`

Must land in `claude-sv` **before** Phase 3's public-sharing task (D-15) starts.
This is the one confirmed real platform gap for the plugin's stated build plan.

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-14 | **[PLATFORM]** Implement RFC 0042 (public plugin page routes): a plugin-declared public page prefix, middleware exemption from the global session gate for that prefix, plugin-owned token-or-session auth for the route (generalising the existing `apiProvider` public-API exemption pattern to pages). Update `docs/rfcs/0042-public-plugin-routes.md` status to Implemented, update `docs/roadmap.md` / matching epic. | — | ⬜ |

---

## Phase 3 — Plugin v0.2 `[PLUGIN]`

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-15 | Public sharing: `docs_public_shares` token registry, public document route (`/docs/p/<token>`) built on RFC 0042's new primitive, expiring-by-default TTL sweep, permanent opt-in. | D-14, D-13 | ⬜ |
| D-16 | GitHub OAuth flow (browser-based, alongside existing PAT) for drive connection, built on `sdk.connections.createOAuthState`/`verifyOAuthState` and a manifest `connections.providers` entry (callback path, scopes, instance `config.public`/`config.secrets` for the OAuth app's client id/secret) — see SPEC.md manifest example. | D-04 | ⬜ |
| D-17 | Rich-text editor toggle over the same Markdown source (round-trip fidelity for frontmatter/code blocks/tables — SPEC open question 3). | D-06 | ⬜ |

---

## Phase 4 — Platform prerequisite for assets `[PLATFORM]` — ✅ already satisfied

Originally planned as a blocker (implement RFC 0044 / `sdk.storage`) before
Phase 5's image/asset task (D-19) could start. **Not needed**: `sdk.storage`
is already implemented (`packages/sdk/src/storage.ts`, RFC 0044 status
Implemented, `claude-sv` `docs/roadmap.md` epic 8.7 ✅) — confirmed during the
2026-07-16 audit. D-18 is retired; D-19 now depends only on D-17. Phase
numbering is left as-is (not renumbered) so existing cross-references stay
valid.

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| ~~D-18~~ | ~~**[PLATFORM]** Implement RFC 0044 (`sdk.storage`)~~ — retired, already implemented on the platform. No action needed. | — | ✅ (n/a) |

---

## Phase 5 — Plugin v0.3 `[PLUGIN]`

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-19 | Images/assets in documents via `sdk.storage` (requires the `storage:readWrite` manifest permission, not yet in the v0.1 manifest — add it here); decide + implement relative-path resolution in editor and public render (SPEC open question 2). | D-17 | ⬜ |
| D-20 | Permanent-public performance: cache/pre-render strategy for permanent public docs (SPEC open question 5). | D-15 | ⬜ |
| D-21 | External-edit conflict resolution UI: surface base-SHA conflicts from D-07 with overwrite/branch/merge options (SPEC open question 4). | D-07 | ⬜ |

**v1.0 stable once D-19–D-21 are done and a hardening/docs pass is complete.**

---

## Phase 6 — Post-v1 (not sequenced, pick up after v1.0)

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-22 | **[PLUGIN]** Multiple repos — drive selection per project/document. | v1.0 | ⬜ |
| D-23 | **[PLUGIN]** Document-content E2EE. The client-side key-management primitive (`sdk.e2ee`: profile/CMK persistence, device enrollment/revocation, recovery wrapper — RFC 0060) is **already implemented** on the platform (`claude-sv` `docs/roadmap.md` epic 8.9 ✅) — re-verify it's still current, but this is now plugin-only work: build per-document encrypt/decrypt in the browser on top of the CMK `sdk.e2ee` manages. No platform RFC needed. | v1.0 | ⬜ |
| D-24 | **[PLUGIN]** GitLab / Gitea provider adapters (implement `GitProvider` for each). | v1.0 | ⬜ |
| D-25 | **[PLATFORM]** RFC 0047 (`sdk.tools`) — only pick up once the platform prioritizes assistant/automation tool contracts; then wire "create document" / "publish draft" as confirmed actions. | — | ⬜ |

---

## Deferred / optional (not blocking)

- **D-00-ci** — A CI workflow for this repo. Drafted in D-00 (compose this
  checkout into a fresh `sovereignfs/sovereign` clone, then run format/lint/
  typecheck/test scoped to this plugin's files — necessary because it depends
  on workspace-only platform packages and can't be verified standalone), then
  dropped as premature scaffolding relative to its actual value at this stage.
  Neither sibling reference plugin (`sovereign-ledger`, `sovereign-plainwrite`)
  has one yet either — revisit once there's an established convention for
  verifying externally-maintained `sovereign` plugins in CI.
- **D-16-shared** — Extract the `GitProvider` REST adapter (built plugin-local
  in D-03) into a shared package usable by both Sovereign Docs and Plainwrite
  (SPEC open question 6). No credential-crypto pattern to extract anymore —
  that's platform-owned via `sdk.secrets`/`sdk.connections`, not plugin code.
  Do this only after both plugins' adapters have stabilized independently —
  premature extraction risks locking in the wrong interface. `[PLATFORM]` if
  it becomes a `packages/*` package, `[PLUGIN]` if it stays a copy-paste
  convention.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-07-16 | Completed D-00 bootstrap: `package.json`, `tsconfig.json`, `manifest.json` (`shell: default` — `plugins/ledger` was earlier misread as using `minimal`; it actually uses `default` like every other product plugin), placeholder `EmptyState` page/layout matching Ledger's under-construction convention, README. A composed-clone CI workflow was drafted then dropped — see Deferred section. |
| 2026-07-16 | Re-verified platform readiness against `claude-sv` code (not RFC frontmatter, which lags reality). Corrected `sdk.storage` from "stub" to implemented (RFC 0044) — retired Phase 4/D-18. Found `sdk.connections` (RFC 0049) implemented and unblocking — redesigned D-02/D-03/D-04/D-13/D-16 to build on it instead of a plugin-local `docs_credentials` table + custom encryption. Found `sdk.e2ee` (RFC 0060) implemented — updated D-23 from a platform-blocked unknown to plugin-only work. Fixed SPEC open-question numbering (D-17/D-19/D-20/D-21/D-16-shared references). |
| 2026-07-12 | Initial roadmap, derived from SPEC.md build plan + platform audit. |
