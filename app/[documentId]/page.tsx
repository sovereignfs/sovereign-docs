import { notFound } from 'next/navigation';
import { DocumentEditor } from '../_components/DocumentEditor';
import { getDocumentForEdit, saveDocument } from '../_lib/documents';

interface DocumentPageProps {
  params: Promise<{ documentId: string }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { documentId } = await params;
  const document = await getDocumentForEdit(documentId);
  if (!document) notFound();

  return (
    <DocumentEditor
      title={document.title}
      content={document.content}
      storage={document.storage}
      canEdit={document.canEdit}
      saveAction={saveDocument.bind(null, documentId)}
    />
  );
}
