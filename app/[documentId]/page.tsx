import { notFound } from 'next/navigation';
import { DocumentPage } from '../_components/DocumentPage';
import { getDrive } from '../_lib/actions';
import { getDocumentForEdit, saveDocument } from '../_lib/documents';
import { getRevisionContent, listDocumentRevisions, syncDocumentToGit } from '../_lib/git-sync';
import { getDefaultView, setDefaultView } from '../_lib/prefs';

interface DocumentRouteProps {
  params: Promise<{ documentId: string }>;
}

export default async function DocumentRoute({ params }: DocumentRouteProps) {
  const { documentId } = await params;
  const [document, defaultView, drive] = await Promise.all([
    getDocumentForEdit(documentId),
    getDefaultView(),
    getDrive(),
  ]);
  if (!document) notFound();

  return (
    <DocumentPage
      title={document.title}
      slug={document.slug}
      content={document.content}
      storage={document.storage}
      syncStatus={document.syncStatus}
      driveConnected={drive?.status === 'connected'}
      canEdit={document.canEdit}
      defaultView={defaultView}
      saveAction={saveDocument.bind(null, documentId)}
      setDefaultViewAction={setDefaultView}
      syncAction={syncDocumentToGit.bind(null, documentId)}
      listRevisionsAction={listDocumentRevisions.bind(null, documentId)}
      getRevisionContentAction={getRevisionContent.bind(null, documentId)}
    />
  );
}
