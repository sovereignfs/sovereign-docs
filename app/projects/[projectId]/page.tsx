import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState, PageHeader } from '@sovereignfs/ui';
import { CreateDocumentDialog } from '../../_components/CreateDocumentDialog';
import { Tile } from '../../_components/Tile';
import { getDrive } from '../../_lib/actions';
import { getProjectOverview } from '../../_lib/documents';
import styles from './page.module.css';

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const overview = await getProjectOverview(projectId);
  if (!overview) notFound();

  const drive = await getDrive();
  const driveConnected = drive?.status === 'connected';
  const { project, documents } = overview;

  return (
    <div className={styles.page}>
      <Link href="/docs" className={styles.backLink}>
        ← Docs
      </Link>

      <PageHeader
        title={project.name}
        action={
          <CreateDocumentDialog
            projects={[]}
            driveConnected={driveConnected}
            fixedProjectId={project.id}
          />
        }
      />

      {documents.length === 0 ? (
        <EmptyState
          heading="No documents in this project yet"
          description="Create the first one to get started."
          action={
            <CreateDocumentDialog
              projects={[]}
              driveConnected={driveConnected}
              fixedProjectId={project.id}
            />
          }
        />
      ) : (
        <ul className={styles.grid}>
          {documents.map((doc) => (
            <li key={doc.id}>
              <Tile
                href={`/docs/${doc.id}`}
                label={doc.title}
                badge={doc.storage === 'git' ? 'Git' : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
