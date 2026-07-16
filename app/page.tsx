import { EmptyState, PageHeader } from '@sovereignfs/ui';
import { ConnectDriveForm } from './_components/ConnectDriveForm';
import { DriveStatusCard } from './_components/DriveStatusCard';
import { getDrive } from './_lib/actions';
import styles from './page.module.css';

export default async function SovereignDocsIndexPage() {
  const drive = await getDrive();

  return (
    <div className={styles.page}>
      <PageHeader title="Docs" description="A git-backed document workspace." />

      {drive ? (
        <>
          <DriveStatusCard drive={drive} />
          {drive.status === 'connected' ? (
            <EmptyState
              heading="Documents are coming soon"
              description="Creating projects and documents lands in a later task — see roadmap.md."
            />
          ) : (
            <ConnectDriveForm reconnect />
          )}
        </>
      ) : (
        <ConnectDriveForm />
      )}
    </div>
  );
}
