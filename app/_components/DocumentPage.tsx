'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Input, SegmentedControl, Textarea } from '@sovereignfs/ui';
import type { ActionResult } from '../_lib/context';
import type { DefaultView } from '../_lib/prefs';
import { RichTextEditor } from './RichTextEditor';
import styles from './DocumentPage.module.css';

const AUTOSAVE_IDLE_MS = 2000;

type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';
type Mode = 'view' | 'edit';

interface DocumentPageProps {
  title: string;
  slug: string;
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

const MODE_OPTIONS: { label: string; value: Mode }[] = [
  { label: 'View', value: 'view' },
  { label: 'Edit', value: 'edit' },
];

/**
 * Document viewer + editor (D-08/D-10/D-11). Markdown (`content`) is always
 * the single source of truth and lives here, not inside a child editor
 * component — lifted up so switching between the read-only viewer and the
 * editor never loses in-progress edits, and so the WYSIWYG view (a separate
 * component reading `content` once at mount) always remounts fresh from
 * whatever the current value is rather than needing to reactively sync a
 * ProseMirror doc against external changes.
 *
 * Opens in **view mode** by default (SPEC.md DOCS-08/DOCS-09) — the edit
 * toggle only renders when `canEdit` is true (permission-gated; today that's
 * always the owner, since sharing is D-13, but the same `docs_document_members`
 * check `getDocumentForEdit` already runs will apply to shared viewers too).
 */
export function DocumentPage({
  title: initialTitle,
  slug,
  content: initialContent,
  storage,
  canEdit,
  defaultView,
  saveAction,
  setDefaultViewAction,
}: DocumentPageProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [lastSaved, setLastSaved] = useState({ title: initialTitle, content: initialContent });
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  const [view, setView] = useState<DefaultView>(defaultView);
  const [mode, setMode] = useState<Mode>('view');

  const isEditing = canEdit && mode === 'edit';
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
    if (!isEditing || !isDirty) return;
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
  }, [title, content, isDirty, isEditing, saveAction]);

  function handleViewChange(next: DefaultView) {
    setView(next);
    // Fire-and-forget: the toggle itself is the confirmation: a failed
    // preference save just means it doesn't stick next visit, not worth
    // blocking or erroring the editor over.
    void setDefaultViewAction(next);
  }

  function handleDownload() {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Link href="/docs" className={styles.backLink}>
          ← Docs
        </Link>
        <div className={styles.status}>
          {storage === 'git' ? <span className={styles.badge}>Git</span> : null}
          {isEditing && autosaveState !== 'idle' ? (
            <span
              className={styles.autosaveStatus}
              role={autosaveState === 'error' ? 'alert' : undefined}
            >
              {autosaveLabel(autosaveState)}
            </span>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={handleDownload}>
            Download .md
          </Button>
          {canEdit && (
            <SegmentedControl
              value={mode}
              onChange={setMode}
              options={MODE_OPTIONS}
              size="sm"
              aria-label="View or edit"
            />
          )}
        </div>
      </div>

      <Input
        className={styles.title}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Untitled document"
        aria-label="Document title"
        readOnly={!isEditing}
      />

      {isEditing && (
        <SegmentedControl
          value={view}
          onChange={handleViewChange}
          options={VIEW_OPTIONS}
          size="sm"
          aria-label="Editor view"
        />
      )}

      {!isEditing ? (
        <RichTextEditor content={content} onChange={setContent} readOnly showToolbar={false} />
      ) : view === 'markdown' ? (
        <Textarea
          className={styles.body}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Start writing in Markdown…"
          aria-label="Document content"
          rows={24}
        />
      ) : (
        // Conditional rendering (not a `key`) is what remounts this fresh
        // from the latest `content` on every markdown→wysiwyg switch — no
        // explicit key needed, and a content-derived key would wrongly
        // remount (losing cursor position) on every keystroke instead.
        <RichTextEditor content={content} onChange={setContent} readOnly={false} />
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
