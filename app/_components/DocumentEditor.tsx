'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Input, SegmentedControl, Textarea } from '@sovereignfs/ui';
import type { ActionResult } from '../_lib/context';
import type { DefaultView } from '../_lib/prefs';
import { RichTextEditor } from './RichTextEditor';
import styles from './DocumentEditor.module.css';

const AUTOSAVE_IDLE_MS = 2000;

type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

interface DocumentEditorProps {
  title: string;
  content: string;
  storage: 'local' | 'git';
  canEdit: boolean;
  defaultView: DefaultView;
  saveAction: (formData: FormData) => Promise<ActionResult>;
  setDefaultViewAction: (view: DefaultView) => Promise<void>;
}

const VIEW_OPTIONS: { label: string; value: DefaultView }[] = [
  { label: 'Markdown', value: 'markdown' },
  { label: 'Rich text', value: 'wysiwyg' },
];

/**
 * Markdown-canonical editor with autosave (D-08) and a Markdown ⇄ WYSIWYG
 * view toggle (D-10). Markdown (`content`) is always the single source of
 * truth — the WYSIWYG view (RichTextEditor) is just another way to edit the
 * same string, not a separate storage format. The two views are rendered
 * behind a conditional (not both mounted at once), so switching into
 * WYSIWYG always mounts RichTextEditor fresh from whatever `content`
 * currently holds, rather than needing to reactively sync a ProseMirror doc
 * against external changes.
 */
export function DocumentEditor({
  title: initialTitle,
  content: initialContent,
  storage,
  canEdit,
  defaultView,
  saveAction,
  setDefaultViewAction,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [lastSaved, setLastSaved] = useState({ title: initialTitle, content: initialContent });
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  const [view, setView] = useState<DefaultView>(defaultView);

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

  function handleViewChange(next: DefaultView) {
    setView(next);
    // Fire-and-forget: the toggle itself is the confirmation: a failed
    // preference save just means it doesn't stick next visit, not worth
    // blocking or erroring the editor over.
    void setDefaultViewAction(next);
  }

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

      <SegmentedControl
        value={view}
        onChange={handleViewChange}
        options={VIEW_OPTIONS}
        size="sm"
        aria-label="Editor view"
      />

      {view === 'markdown' ? (
        <Textarea
          className={styles.body}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Start writing in Markdown…"
          aria-label="Document content"
          readOnly={!canEdit}
          rows={24}
        />
      ) : (
        // Conditional rendering (not a `key`) is what remounts this fresh
        // from the latest `content` on every markdown→wysiwyg switch — no
        // explicit key needed, and a content-derived key would wrongly
        // remount (losing cursor position) on every keystroke instead.
        <RichTextEditor content={content} onChange={setContent} readOnly={!canEdit} />
      )}
    </div>
  );
}

function autosaveLabel(state: AutosaveState) {
  if (state === 'saving') return 'Saving…';
  if (state === 'saved') return 'All changes saved';
  if (state === 'error') return 'Autosave failed — check your connection.';
  return null;
}
