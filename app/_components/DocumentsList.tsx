import { Card } from '@sovereignfs/ui';
import type { DocumentsOverview } from '../_lib/documents';
import { CreateDocumentDialog } from './CreateDocumentDialog';
import { CreateProjectDialog } from './CreateProjectDialog';
import styles from './DocumentsList.module.css';

/**
 * Minimal, functional project/document list + quota indicator (D-07). The
 * polished Google-Docs/Drive-style layout (search, grid, project navigation)
 * is D-09's remit — this exists so create + the quota gate are exercisable
 * end to end before that lands.
 */
export function DocumentsList({ overview }: { overview: DocumentsOverview }) {
  const { projects, documents, localCount, limit, driveConnected } = overview;

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <p className={styles.quota}>
          {driveConnected
            ? 'Unlimited documents (Git connected)'
            : `${localCount} of ${limit} documents`}
        </p>
        <div className={styles.actions}>
          <CreateProjectDialog />
          <CreateDocumentDialog projects={projects} driveConnected={driveConnected} />
        </div>
      </div>

      {projects.length === 0 && documents.length === 0 ? (
        <Card padding="lg" className={styles.empty}>
          No documents yet — create your first one to get started.
        </Card>
      ) : (
        <div className={styles.lists}>
          {projects.length > 0 && (
            <div>
              <h2 className={styles.heading}>Projects</h2>
              <ul className={styles.list}>
                {projects.map((project) => (
                  <li key={project.id}>{project.name}</li>
                ))}
              </ul>
            </div>
          )}
          {documents.length > 0 && (
            <div>
              <h2 className={styles.heading}>Documents</h2>
              <ul className={styles.list}>
                {documents.map((doc) => (
                  <li key={doc.id}>
                    {doc.title}
                    {doc.storage === 'git' ? <span className={styles.badge}>Git</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
