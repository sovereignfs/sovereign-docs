import { notFound } from 'next/navigation';
import { DocumentPage } from '../_components/DocumentPage';
import { getDocumentForEdit, saveDocument } from '../_lib/documents';
import { getDefaultView, setDefaultView } from '../_lib/prefs';

interface DocumentRouteProps {
  params: Promise<{ documentId: string }>;
}

export default async function DocumentRoute({ params }: DocumentRouteProps) {
  const { documentId } = await params;
  const [document, defaultView] = await Promise.all([
    getDocumentForEdit(documentId),
    getDefaultView(),
  ]);
  if (!document) notFound();

  return (
    <DocumentPage
      title={document.title}
      slug={document.slug}
      content={document.content}
      storage={document.storage}
      canEdit={document.canEdit}
      defaultView={defaultView}
      saveAction={saveDocument.bind(null, documentId)}
      setDefaultViewAction={setDefaultView}
    />
  );
}
