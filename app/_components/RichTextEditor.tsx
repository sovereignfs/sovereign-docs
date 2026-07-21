'use client';

import { type ReactNode } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import styles from './RichTextEditor.module.css';

interface RichTextEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  readOnly: boolean;
}

/**
 * The WYSIWYG view (D-10) — a rich-text surface over the same Markdown
 * `docs_documents.content` the Markdown view edits directly. Markdown stays
 * the single source of truth: this component only reads `content` once, at
 * mount (TipTap's `content` prop), so switching views remounts it fresh from
 * whatever the Markdown textarea currently holds rather than needing to
 * reactively sync a ProseMirror doc against external changes — see
 * DocumentEditor.tsx, which keys this component on the view so a
 * mode-switch always remounts.
 *
 * StarterKit (Tiptap v3) already bundles everything SPEC.md's "small
 * feature set" needs — bold/italic/underline/headings/lists/links/code —
 * with no extra `@tiptap/extension-*` packages required (confirmed against
 * `sovereign-plainwrite`'s equivalent editor, the established pattern this
 * is ported from). Images are out of scope here (D-19, `sdk.storage`).
 *
 * `html: false` on the Markdown extension is a deliberate security choice,
 * not the library default (`true`): it keeps raw HTML embedded in a
 * document's Markdown from being parsed into live DOM nodes here.
 */
export function RichTextEditor({ content, onChange, readOnly }: RichTextEditorProps) {
  const editor = useEditor({
    // Next.js SSR: without this, TipTap tries to render on the server,
    // which produces a hydration mismatch on a component that's genuinely
    // client-only.
    immediatelyRender: false,
    content,
    editable: !readOnly,
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false,
        transformPastedText: true,
      }),
    ],
    onUpdate: ({ editor: instance }) => {
      const markdownStorage = instance.storage as unknown as { markdown: MarkdownStorage };
      onChange(markdownStorage.markdown.getMarkdown());
    },
    editorProps: {
      attributes: {
        class: styles.prose ?? '',
        'aria-label': 'Document content',
      },
    },
  });

  if (!editor) {
    return <div className={styles.loading}>Loading editor…</div>;
  }

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive('underline')}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </ToolbarButton>
        <span className={styles.divider} aria-hidden="true" />
        <ToolbarButton
          label="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <span className={styles.divider} aria-hidden="true" />
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <span className={styles.divider} aria-hidden="true" />
        <ToolbarButton
          label="Link"
          active={editor.isActive('link')}
          disabled={readOnly}
          onClick={() => {
            const previousUrl = editor.getAttributes('link').href as string | undefined;
            const url = window.prompt('Link URL', previousUrl ?? 'https://');
            if (url === null) return;
            if (url === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}
        >
          Link
        </ToolbarButton>
        <ToolbarButton
          label="Code"
          active={editor.isActive('code')}
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          {'</>'}
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className={styles.content} />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={active ? styles.toolbarButtonActive : styles.toolbarButton}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
