import type { ReactNode } from 'react';

/**
 * Base shell for the Sovereign Docs plugin. Deliberately minimal at this
 * scaffold stage (roadmap.md D-00) — no nav/editor chrome yet, since no
 * feature screens exist to navigate between. Grows as the index, editor,
 * viewer, and share screens land in later tasks.
 */
export default function SovereignDocsLayout({ children }: { children: ReactNode }) {
  return children;
}
