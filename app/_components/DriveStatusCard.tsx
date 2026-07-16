'use client';

import { useActionState } from 'react';
import { Button, Card, StatusBadge } from '@sovereignfs/ui';
import { disconnectDrive, type ActionResult, type DriveView } from '../_lib/actions';
import styles from './DriveStatusCard.module.css';

export function DriveStatusCard({ drive }: { drive: DriveView }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    disconnectDrive,
    null,
  );
  const connected = drive.status === 'connected';

  return (
    <Card padding="lg" className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>
            {drive.repoOwner}/{drive.repoName}
          </h2>
          <p className={styles.branch}>Branch: {drive.branch}</p>
        </div>
        <StatusBadge status={connected ? 'synced' : 'warning'}>
          {connected ? 'Connected' : 'Reconnect needed'}
        </StatusBadge>
      </div>

      {drive.login ? <p className={styles.detail}>Connected as {drive.login}</p> : null}
      {drive.lastError ? <p className={styles.feedbackError}>{drive.lastError}</p> : null}

      {state && !state.ok ? (
        <p className={styles.feedbackError} role="status" aria-live="polite">
          {state.error}
        </p>
      ) : null}

      <form action={formAction}>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      </form>
    </Card>
  );
}
