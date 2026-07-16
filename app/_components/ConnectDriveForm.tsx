'use client';

import { useActionState } from 'react';
import { Button, Card, FormField, Input } from '@sovereignfs/ui';
import { connectDrive, type ActionResult } from '../_lib/actions';
import styles from './ConnectDriveForm.module.css';

export function ConnectDriveForm({ reconnect = false }: { reconnect?: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    connectDrive,
    null,
  );

  return (
    <Card padding="lg" className={styles.card}>
      <h2 className={styles.heading}>
        {reconnect ? 'Reconnect your GitHub repository' : 'Connect your GitHub repository'}
      </h2>
      <p className={styles.description}>
        Sovereign Docs stores your documents as Markdown files in a GitHub repository you own.
      </p>

      <form action={formAction} className={styles.form}>
        {state && !state.ok ? (
          <p className={styles.feedbackError} role="status" aria-live="polite">
            {state.error}
          </p>
        ) : null}

        <FormField label="GitHub repository" hint="e.g. octocat/notes">
          {(field) => (
            <Input {...field} name="repository" required placeholder="owner/repo-name" />
          )}
        </FormField>

        <FormField label="Branch" hint="Leave blank to use the repository's default branch.">
          {(field) => <Input {...field} name="branch" placeholder="main" />}
        </FormField>

        <FormField
          label="Personal access token"
          hint="Needs read/write access to repository contents. Stored securely, never saved in Docs' own tables."
        >
          {(field) => (
            <Input
              {...field}
              name="token"
              type="password"
              required
              autoComplete="off"
              placeholder="github_pat_..."
            />
          )}
        </FormField>

        <Button type="submit" disabled={pending}>
          {pending ? 'Connecting…' : reconnect ? 'Reconnect repository' : 'Connect repository'}
        </Button>
      </form>
    </Card>
  );
}
