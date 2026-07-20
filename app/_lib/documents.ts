'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { docsDocumentMembers, docsDocuments, docsProjects } from '../_db/schema';
import { getDrive, type DriveView } from './actions';
import type { ActionResult } from './context';
import { getContext, now } from './context';
import {
  DEFAULT_DOCUMENT_TITLE,
  buildGitPath,
  resolveDocumentStorage,
  slugify,
  uniqueSlug,
} from './document-rules';
import { getFreeDocLimit } from './quota';

export type { ActionResult };

export async function createProject(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'Enter a project name.' };

  const existing = await db
    .select({ slug: docsProjects.slug })
    .from(docsProjects)
    .where(and(eq(docsProjects.tenantId, tenantId), eq(docsProjects.ownerId, userId)));

  const slug = uniqueSlug(
    slugify(name),
    new Set(existing.map((row) => row.slug)),
  );

  await db.insert(docsProjects).values({
    id: randomUUID(),
    tenantId,
    ownerId: userId,
    name,
    slug,
    createdAt: now(),
  });

  revalidatePath('/');
  return { ok: true };
}

export async function createDocument(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const title = String(formData.get('title') ?? '').trim() || DEFAULT_DOCUMENT_TITLE;
  const projectIdInput = String(formData.get('projectId') ?? '').trim();
  const requestedStorage = formData.get('storage') === 'git' ? 'git' : 'local';

  let project: { id: string; slug: string } | null = null;
  if (projectIdInput) {
    const rows = await db
      .select({ id: docsProjects.id, slug: docsProjects.slug })
      .from(docsProjects)
      .where(
        and(
          eq(docsProjects.id, projectIdInput),
          eq(docsProjects.tenantId, tenantId),
          eq(docsProjects.ownerId, userId),
        ),
      );
    project = rows[0] ?? null;
    if (!project) return { ok: false, error: 'Project not found.' };
  }

  const drive = await getDrive();
  const driveConnected = drive?.status === 'connected';

  const localCount = (
    await db
      .select({ id: docsDocuments.id })
      .from(docsDocuments)
      .where(
        and(
          eq(docsDocuments.tenantId, tenantId),
          eq(docsDocuments.ownerId, userId),
          eq(docsDocuments.storage, 'local'),
        ),
      )
  ).length;

  const limit = await getFreeDocLimit();
  const decision = resolveDocumentStorage(requestedStorage, localCount, limit, driveConnected);
  if (!decision.ok) return decision;

  const slugFilter = project
    ? and(
        eq(docsDocuments.tenantId, tenantId),
        eq(docsDocuments.ownerId, userId),
        eq(docsDocuments.projectId, project.id),
      )
    : and(
        eq(docsDocuments.tenantId, tenantId),
        eq(docsDocuments.ownerId, userId),
        isNull(docsDocuments.projectId),
      );
  const existingSlugs = await db
    .select({ slug: docsDocuments.slug })
    .from(docsDocuments)
    .where(slugFilter);
  const slug = uniqueSlug(slugify(title), new Set(existingSlugs.map((row) => row.slug)));

  const id = randomUUID();
  const ts = now();
  const isGit = decision.storage === 'git';

  await db.insert(docsDocuments).values({
    id,
    tenantId,
    ownerId: userId,
    projectId: project?.id ?? null,
    title,
    slug,
    content: '',
    storage: decision.storage,
    gitPath: isGit && drive ? buildGitPath(drive.basePath, project?.slug ?? null, slug) : null,
    baseSha: null,
    syncStatus: isGit ? 'pending' : null,
    lastSyncedAt: null,
    createdAt: ts,
    updatedAt: ts,
  });

  await db.insert(docsDocumentMembers).values({
    documentId: id,
    userId,
    tenantId,
    role: 'owner',
    invitedBy: null,
    joinedAt: ts,
  });

  revalidatePath('/');
  return { ok: true };
}

export interface DocumentsOverview {
  projects: { id: string; name: string; slug: string }[];
  documents: {
    id: string;
    title: string;
    slug: string;
    projectId: string | null;
    storage: 'local' | 'git';
  }[];
  localCount: number;
  limit: number;
  driveConnected: boolean;
}

/**
 * Reads the current user's projects/documents plus the quota state, for the
 * plugin index page. `drive` is passed in (rather than fetched here) so a
 * caller that already has it (e.g. the index page) doesn't pay for a second
 * `sdk.connections` round trip.
 */
export async function listDocumentsOverview(drive: DriveView | null): Promise<DocumentsOverview> {
  const { db, userId, tenantId } = await getContext();

  const [projects, documents] = await Promise.all([
    db
      .select({ id: docsProjects.id, name: docsProjects.name, slug: docsProjects.slug })
      .from(docsProjects)
      .where(and(eq(docsProjects.tenantId, tenantId), eq(docsProjects.ownerId, userId))),
    db
      .select({
        id: docsDocuments.id,
        title: docsDocuments.title,
        slug: docsDocuments.slug,
        projectId: docsDocuments.projectId,
        storage: docsDocuments.storage,
      })
      .from(docsDocuments)
      .where(and(eq(docsDocuments.tenantId, tenantId), eq(docsDocuments.ownerId, userId))),
  ]);

  const localCount = documents.filter((doc) => doc.storage === 'local').length;
  const limit = await getFreeDocLimit();

  return {
    projects,
    documents,
    localCount,
    limit,
    driveConnected: drive?.status === 'connected',
  };
}
