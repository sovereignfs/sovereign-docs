'use client';

import { useEffect, useState } from 'react';
import { Dialog, Spinner } from '@sovereignfs/ui';
import type { DocumentRevision } from '../_lib/git-sync';
import styles from './RevisionsPanel.module.css';

interface RevisionsPanelProps {
  open: boolean;
  onClose: () => void;
  listRevisionsAction: () => Promise<DocumentRevision[]>;
  getRevisionContentAction: (sha: string) => Promise<string | null>;
}

/**
 * Git commit history for a document's file, filtered by path (D-12) —
 * read-only; there's no restore/diff action yet (SPEC.md open question 4,
 * D-21). Revisions load lazily on open rather than with the page, since
 * they're a secondary view most visits never open.
 */
export function RevisionsPanel({
  open,
  onClose,
  listRevisionsAction,
  getRevisionContentAction,
}: RevisionsPanelProps) {
  const [revisions, setRevisions] = useState<DocumentRevision[] | null>(null);
  const [selected, setSelected] = useState<{ sha: string; content: string | null } | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (!open) {
      setRevisions(null);
      setSelected(null);
      return;
    }
    listRevisionsAction().then(setRevisions);
  }, [open, listRevisionsAction]);

  async function handleSelect(sha: string) {
    setLoadingContent(true);
    const content = await getRevisionContentAction(sha);
    setSelected({ sha, content });
    setLoadingContent(false);
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg" title="Revisions">
      {selected ? (
        <div className={styles.revisionView}>
          <button type="button" className={styles.backButton} onClick={() => setSelected(null)}>
            ← All revisions
          </button>
          {loadingContent ? (
            <Spinner />
          ) : (
            <pre className={styles.revisionContent}>
              {selected.content ?? 'Unable to load this revision.'}
            </pre>
          )}
        </div>
      ) : revisions === null ? (
        <Spinner />
      ) : revisions.length === 0 ? (
        <p className={styles.empty}>
          No revisions yet — sync this document to Git to start recording history.
        </p>
      ) : (
        <ul className={styles.list}>
          {revisions.map((revision) => (
            <li key={revision.sha}>
              <button
                type="button"
                className={styles.revisionButton}
                onClick={() => handleSelect(revision.sha)}
              >
                <span className={styles.message}>{revision.message || '(no message)'}</span>
                <span className={styles.meta}>
                  {revision.authorName ?? revision.authorLogin ?? 'Unknown'}
                  {revision.committedAt
                    ? ` · ${new Date(revision.committedAt).toLocaleString()}`
                    : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
