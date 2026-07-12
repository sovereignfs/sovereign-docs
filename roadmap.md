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

As of the last audit (2026-07-12), the platform already provides everything
v0.1 needs: `sdk.directory`, `sdk.secrets` (real AES-256-GCM vault —
**supersedes** SPEC.md's "plugin-local AES-GCM fallback" note, ignore that
part of the spec), `sdk.data`, `sdk.notifications`, and `shell: minimal`
(already wired — ignore SPEC.md's "unwired" note; use `shell: minimal`
directly instead of `shell: default` + CSS-collapse). **No platform work
blocks starting Phase 1.**

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-00 | **[PLUGIN]** Bootstrap this repo: `package.json`, `tsconfig` (extend `@sovereignfs/tsconfig`), ESLint/Prettier config matching `claude-sv` conventions, `manifest.json` skeleton (id `fs.sovereign.docs`, `type: sovereign`, `runtime: native`, `shell: minimal`), CI workflow, README pointing to SPEC.md + this roadmap. | — | ⬜ |
| D-01 | **[PLATFORM]** Re-verify Phase 0 findings are still current (`sdk.storage` still a stub in `packages/sdk/src/unimplemented.ts`, RFC 0042 still Draft/no code, `sdk.tools` still absent) immediately before starting Phase 3 and Phase 4 — SDK surfaces can change between now and then. No code change unless something regressed. | — | ⬜ |

---

## Phase 1 — Plugin v0.1 core (private + instance sharing, no platform gaps) `[PLUGIN]`

Everything in this phase runs entirely on primitives that already exist.

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-02 | DB schema: `docs_drives`, `docs_credentials`, `docs_projects`, `docs_documents`, `docs_drafts`, `docs_document_members` (all `tenant_id`-scoped per SPEC data model). Migration + Drizzle schema file. | D-00 | ⬜ |
| D-03 | Git provider adapter: `GitProvider` interface + `GitHubProvider` implementation (list/read via Contents/Trees API, publish single file, publish multi-file via Git Data API, commits API for revisions). Port the pattern from `sovereign-plainwrite`'s `_lib/git-providers.ts` — do not wait for a shared package (see D-16). | D-02 | ⬜ |
| D-04 | Drive config UI + server actions: connect a repo via **GitHub PAT**, store token via `sdk.secrets`, create `docs/` dir on connect, `docs_drives` row insert. `[parallel]`-safe with D-05 once D-03 lands. | D-03 | ⬜ |
| D-05 | Create project / create document flows: name prompt → slug, `docs_projects` / `docs_documents` rows, owner membership row auto-inserted. | D-02 | ⬜ |
| D-06 | Markdown editor (minimalistic, Markdown-first) + **Save** (writes `docs_drafts`, never touches git). | D-05 | ⬜ |
| D-07 | **Publish** flow: push draft content via git adapter, record `base_sha`, flip `docs_documents.status` to `published`, conflict check against stored `base_sha`. | D-03, D-06 | ⬜ |
| D-08 | Revisions panel: commits API filtered by file path, render a revision at a given SHA. | D-07 | ⬜ |
| D-09 | Plugin index: projects + documents owned by / shared with the user. | D-05 | ⬜ |
| D-10 | Viewer (read-only render) + edit-mode toggle (permission-gated). | D-06 | ⬜ |
| D-11 | Instance sharing: share dialog using `sdk.directory` for the user picker, `docs_document_members` roles (owner/editor/viewer), `sdk.mailer` + `sdk.notifications` share alerts. | D-09, `sdk.directory` (ready) | ⬜ |
| D-12 | Portability: export (metadata, drafts, shares, connection metadata — no credentials) and import (additive, no remote recreation) per SPEC "Portability and deletion"; user-deletion handler (revoke shares, transfer/archive per membership). | D-02..D-11 | ⬜ |
| D-13 | v0.1 hardening pass: no-default-secret check on the vault key path, tenant-scoping test sweep across all `docs_*` tables, error-state UI (failed publish, expired token, revoked GitHub access). | D-12 | ⬜ |

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
| D-16 | GitHub OAuth flow (browser-based, alongside existing PAT) for drive connection. | D-04 | ⬜ |
| D-17 | Rich-text editor toggle over the same Markdown source (round-trip fidelity for frontmatter/code blocks/tables — SPEC open question 4). | D-06 | ⬜ |

---

## Phase 4 — Platform prerequisite for assets `[PLATFORM]`

Must land in `claude-sv` **before** Phase 5's image/asset task (D-19) starts.

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-18 | **[PLATFORM]** Implement RFC 0044 (`sdk.storage`): replace the `NotImplementedError` stubs in `packages/sdk/src/unimplemented.ts` with a real `put()`/`get()` backed by an actual storage surface. Update RFC status + `docs/roadmap.md` / matching epic. | — | ⬜ |

---

## Phase 5 — Plugin v0.3 `[PLUGIN]`

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-19 | Images/assets in documents via `sdk.storage`; decide + implement relative-path resolution in editor and public render (SPEC open question 3). | D-18, D-17 | ⬜ |
| D-20 | Permanent-public performance: cache/pre-render strategy for permanent public docs (SPEC open question 6). | D-15 | ⬜ |
| D-21 | External-edit conflict resolution UI: surface base-SHA conflicts from D-07 with overwrite/branch/merge options (SPEC open question 5). | D-07 | ⬜ |

**v1.0 stable once D-19–D-21 are done and a hardening/docs pass is complete.**

---

## Phase 6 — Post-v1 (not sequenced, pick up after v1.0)

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| D-22 | **[PLUGIN]** Multiple repos — drive selection per project/document. | v1.0 | ⬜ |
| D-23 | **[PLATFORM/PLUGIN]** Document-content E2EE via `sdk.crypto` (does not exist yet — check platform status before starting; likely needs its own platform RFC). | v1.0 | ⬜ |
| D-24 | **[PLUGIN]** GitLab / Gitea provider adapters (implement `GitProvider` for each). | v1.0 | ⬜ |
| D-25 | **[PLATFORM]** RFC 0047 (`sdk.tools`) — only pick up once the platform prioritizes assistant/automation tool contracts; then wire "create document" / "publish draft" as confirmed actions. | — | ⬜ |

---

## Deferred / optional (not blocking)

- **D-16-shared** — Extract the `GitProvider` adapter + credential-crypto pattern
  (built plugin-local in D-03) into a shared package usable by both Sovereign
  Docs and Plainwrite (SPEC open question 7). Do this only after both plugins'
  adapters have stabilized independently — premature extraction risks locking
  in the wrong interface. `[PLATFORM]` if it becomes a `packages/*` package,
  `[PLUGIN]` if it stays a copy-paste convention.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-07-12 | Initial roadmap, derived from SPEC.md build plan + platform audit. |
