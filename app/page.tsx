import { PageHeader } from '@sovereignfs/ui';
import { ConnectDriveForm } from './_components/ConnectDriveForm';
import { DocumentsList } from './_components/DocumentsList';
import { DriveStatusCard } from './_components/DriveStatusCard';
import { getDrive } from './_lib/actions';
import { listDocumentsOverview } from './_lib/documents';
import styles from './page.module.css';

export default async function SovereignDocsIndexPage() {
  const drive = await getDrive();
  const overview = await listDocumentsOverview(drive);

  return (
    <div className={styles.page}>
      <PageHeader title="Docs" description="A local-first document workspace." />

      <DocumentsList overview={overview} />

      {drive ? (
        <>
          <DriveStatusCard drive={drive} />
          {drive.status !== 'connected' ? <ConnectDriveForm reconnect /> : null}
        </>
      ) : (
        <ConnectDriveForm />
      )}
    </div>
  );
}
