import Link from 'next/link';
import { PageHeader } from '@sovereignfs/ui';
import { DocumentsList } from './_components/DocumentsList';
import { getDrive } from './_lib/actions';
import { listDocumentsOverview } from './_lib/documents';
import styles from './page.module.css';

export default async function SovereignDocsIndexPage() {
  const drive = await getDrive();
  const overview = await listDocumentsOverview(drive);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Docs"
        description="A local-first document workspace."
        action={
          <Link href="/docs/settings" className={styles.settingsLink}>
            Settings
          </Link>
        }
      />

      <DocumentsList overview={overview} />
    </div>
  );
}
