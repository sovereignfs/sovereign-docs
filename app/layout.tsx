import type { ReactNode } from 'react';
import { registerPortabilityHandlers } from './_lib/portability';

/**
 * Base shell for the Sovereign Docs plugin. Deliberately minimal at this
 * scaffold stage (roadmap.md D-00) — no nav/editor chrome yet, since no
 * feature screens exist to navigate between. Grows as the index, editor,
 * viewer, and share screens land in later tasks.
 */
export default async function SovereignDocsLayout({ children }: { children: ReactNode }) {
  // In-process and reset on restart — the platform SDK requires
  // re-registering from a request-scoped plugin route, so this runs on
  // every request. Best-effort: a registration failure must not block the
  // plugin's own UI (matches sovereign-tasks' layout.tsx).
  try {
    await registerPortabilityHandlers();
  } catch {
    // Portability is a best-effort platform integration.
  }

  return children;
}
