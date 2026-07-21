import { notFound } from 'next/navigation';
import { DocumentEditor } from '../_components/DocumentEditor';
import { getDocumentForEdit, saveDocument } from '../_lib/documents';
import { getDefaultView, setDefaultView } from '../_lib/prefs';

interface DocumentPageProps {
  params: Promise<{ documentId: string }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { documentId } = await params;
  const [document, defaultView] = await Promise.all([
    getDocumentForEdit(documentId),
    getDefaultView(),
  ]);
  if (!document) notFound();

  return (
    <DocumentEditor
      title={document.title}
      content={document.content}
      storage={document.storage}
      canEdit={document.canEdit}
      defaultView={defaultView}
      saveAction={saveDocument.bind(null, documentId)}
      setDefaultViewAction={setDefaultView}
    />
  );
}
