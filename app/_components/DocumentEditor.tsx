'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Input, Textarea } from '@sovereignfs/ui';
import type { ActionResult } from '../_lib/context';
import styles from './DocumentEditor.module.css';

const AUTOSAVE_IDLE_MS = 2000;

type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

interface DocumentEditorProps {
  title: string;
  content: string;
  storage: 'local' | 'git';
  canEdit: boolean;
  saveAction: (formData: FormData) => Promise<ActionResult>;
}

/**
 * Markdown-canonical editor with autosave (D-08). WYSIWYG (D-10) is a view
 * over the same Markdown content added later, not a separate storage format.
 */
export function DocumentEditor({ title: initialTitle, content: initialContent, storage, canEdit, saveAction }: DocumentEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [lastSaved, setLastSaved] = useState({ title: initialTitle, content: initialContent });
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');

  const isDirty = title !== lastSaved.title || content !== lastSaved.content;

  // Warn on tab close while an edit hasn't been autosaved yet.
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!canEdit || !isDirty) return;
    const timer = setTimeout(() => {
      setAutosaveState('saving');
      const formData = new FormData();
      formData.set('title', title);
      formData.set('content', content);
      saveAction(formData)
        .then((result) => {
          if (result.ok) {
            setLastSaved({ title, content });
            setAutosaveState('saved');
          } else {
            setAutosaveState('error');
          }
        })
        .catch(() => setAutosaveState('error'));
    }, AUTOSAVE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [title, content, isDirty, canEdit, saveAction]);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Link href="/docs" className={styles.backLink}>
          ← Docs
        </Link>
        <div className={styles.status}>
          {storage === 'git' ? <span className={styles.badge}>Git</span> : null}
          {canEdit && autosaveState !== 'idle' ? (
            <span
              className={styles.autosaveStatus}
              role={autosaveState === 'error' ? 'alert' : undefined}
            >
              {autosaveLabel(autosaveState)}
            </span>
          ) : null}
        </div>
      </div>

      <Input
        className={styles.title}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Untitled document"
        aria-label="Document title"
        readOnly={!canEdit}
      />

      <Textarea
        className={styles.body}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Start writing in Markdown…"
        aria-label="Document content"
        readOnly={!canEdit}
        rows={24}
      />
    </div>
  );
}

function autosaveLabel(state: AutosaveState) {
  if (state === 'saving') return 'Saving…';
  if (state === 'saved') return 'All changes saved';
  if (state === 'error') return 'Autosave failed — check your connection.';
  return null;
}
