# Sovereign Docs

Sovereign Docs is a Sovereign plugin for writing and organizing Markdown
documents in a git repository you own (your "Sovereign Drive"). Documents are
drafted on the platform and published to git on demand; revisions read back
from git history.

Full specification: [SPEC.md](SPEC.md). Build sequence and status:
[roadmap.md](roadmap.md).

## Current scope

This checkout is currently a **bootstrap skeleton** (roadmap task D-00):
`package.json`, `tsconfig.json` (extends `@sovereignfs/tsconfig`),
`manifest.json` (id `fs.sovereign.docs`, `shell: minimal`), and a placeholder
`/docs` page. No document, drive-connection, or sharing functionality exists
yet — that's the rest of `roadmap.md` Phase 1 onward.

## Local development

To test this standalone checkout against the platform, clone or copy it into
a platform workspace as a local plugin checkout:

```
plugins/sovereign-docs.local
```

Then run the platform generate/dev workflow from the platform repository:

```bash
pnpm generate
pnpm dev
```

The app is served at `/docs` once composed by the platform.

## Deployment requirements

Sovereign Docs will store connected GitHub credentials (both OAuth tokens and
personal access tokens) through the platform's plugin secret vault
(`sdk.secrets`), never in its own tables. That vault requires the platform
operator to set **`SOVEREIGN_VAULT_KEY`** (a 32-byte key, `openssl rand
-base64 32`) in the Sovereign instance's environment before a drive can be
connected. See the platform's `docs/self-hosting.md` for the full variable
reference.
