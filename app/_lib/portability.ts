import { sdk } from '@sovereignfs/sdk';
import type {
  DeletionContext,
  DeletionResult,
  ExportContext,
  ImportContext,
  PluginExportSection,
} from '@sovereignfs/sdk';
import { and, eq, inArray, or } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import {
  docsDocumentMembers,
  docsDocuments,
  docsDrives,
  docsProjects,
  docsUserPrefs,
} from '../_db/schema';

// The SDK intentionally returns an opaque dialect-agnostic DB client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<'async', any, any>;

const PLUGIN_ID = 'fs.sovereign.docs';
// v2: local-first model — a document's canonical Markdown now travels in the
// `documents` array itself (`content`/`storage`), not a separate `drafts`
// array. `docs_drafts` was dropped (SPEC.md v0.3). Richer additions (user view
// preferences, git-sync fields) are D-14's remit; this section keeps parity
// with the restructured schema so export/import/delete stay correct.
const EXPORT_SCHEMA_VERSION = 2;

/**
 * Registers Docs' export/import/delete participation (RFC 0007 / RFC 0033,
 * RFC 0068). Must be called from a request-scoped Docs route — this repo
 * calls it from `app/layout.tsx`, same as every other request-scoped setup
 * (registrations are in-process and reset on restart).
 */
export async function registerPortabilityHandlers(): Promise<void> {
  await sdk.portability.provideExport(exportDocsData);
  await sdk.portability.provideImport(importDocsData);
  await sdk.portability.provideDelete(deleteAllDocsData);
}

// ---- Export shape ----
// A document's canonical Markdown lives in `docs_documents.content` (local-first
// model, SPEC.md v0.3), so it travels with the document row here. For a
// git-backed document the same content is also mirrored to the connected repo;
// that mirror is not re-created on import (a drive needs a live
// `sdk.connections` grant). `docs_drives.connectionId` names an `sdk.connections`
// record with no counterpart on another account or instance, so drive config is
// exported for visibility but not re-created on import (informational only —
// same treatment as `docsDocumentMembers`, which names other users' accounts).

interface ExportDrive {
  branch: string;
  basePath: string;
  createdAt: number;
}

interface ExportProject {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
}

interface ExportDocument {
  id: string;
  projectId: string | null;
  title: string;
  slug: string;
  content: string;
  storage: 'local' | 'git';
  createdAt: number;
  updatedAt: number;
}

interface ExportDocumentMember {
  documentId: string;
  role: 'owner' | 'editor' | 'viewer';
  invitedBy: string | null;
  joinedAt: number;
}

interface DocsExportData {
  /** null when the user never connected a git drive. Informational only. */
  drive: ExportDrive | null;
  projects: ExportProject[];
  documents: ExportDocument[];
  /** The user's own membership rows, on documents they own or are a member of. Informational only. */
  documentMembers: ExportDocumentMember[];
}

async function exportDocsData(ctx: ExportContext): Promise<PluginExportSection> {
  const db = (await sdk.db.getClient()) as Db;
  const { userId, tenantId } = ctx;

  const [driveRows, projectRows, documentRows, memberRows] = await Promise.all([
    db.select().from(docsDrives).where(and(eq(docsDrives.tenantId, tenantId), eq(docsDrives.userId, userId))),
    db.select().from(docsProjects).where(and(eq(docsProjects.tenantId, tenantId), eq(docsProjects.ownerId, userId))),
    db.select().from(docsDocuments).where(and(eq(docsDocuments.tenantId, tenantId), eq(docsDocuments.ownerId, userId))),
    db.select().from(docsDocumentMembers).where(and(eq(docsDocumentMembers.tenantId, tenantId), eq(docsDocumentMembers.userId, userId))),
  ]);

  const driveRow = driveRows[0];
  const data: DocsExportData = {
    drive: driveRow
      ? { branch: driveRow.branch, basePath: driveRow.basePath, createdAt: driveRow.createdAt }
      : null,
    projects: projectRows.map((p) => ({ id: p.id, name: p.name, slug: p.slug, createdAt: p.createdAt })),
    documents: documentRows.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      title: d.title,
      slug: d.slug,
      content: d.content,
      storage: d.storage,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    documentMembers: memberRows.map((m) => ({
      documentId: m.documentId,
      role: m.role,
      invitedBy: m.invitedBy,
      joinedAt: m.joinedAt,
    })),
  };

  const warnings = data.drive
    ? ['The connected git drive (repository, branch, credentials) is not re-created on import — reconnect it from Docs settings after importing.']
    : undefined;

  return { pluginId: PLUGIN_ID, schemaVersion: EXPORT_SCHEMA_VERSION, data, warnings };
}

// ---- Import ----
// Additive only. `drive` and `documentMembers` are not re-created — a drive
// needs a live `sdk.connections` grant, and a membership row names another
// user's account with no guaranteed counterpart on this instance. Every
// document is restored as a **local** document (content preserved from the
// export); a git-backed document's remote mirror is not re-created here, so it
// starts local until the user reconnects a drive and re-syncs.

function isDocsExportData(value: unknown): value is DocsExportData {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<DocsExportData>;
  return Array.isArray(c.projects) && Array.isArray(c.documents);
}

async function importDocsData(section: PluginExportSection, ctx: ImportContext): Promise<void> {
  if (section.schemaVersion !== EXPORT_SCHEMA_VERSION || !isDocsExportData(section.data)) {
    throw new Error('Docs import section has an unrecognized shape.');
  }
  const data = section.data;
  const db = (await sdk.db.getClient()) as Db;
  const ts = Math.floor(Date.now() / 1000);

  const originalProjectIds = new Set(data.projects.map((p) => p.id));

  for (const p of data.projects) {
    await db.insert(docsProjects).values({
      id: ctx.remapId(p.id),
      tenantId: ctx.tenantId,
      ownerId: ctx.userId,
      name: p.name,
      slug: p.slug,
      createdAt: p.createdAt,
    });
  }

  for (const d of data.documents) {
    await db.insert(docsDocuments).values({
      id: ctx.remapId(d.id),
      tenantId: ctx.tenantId,
      ownerId: ctx.userId,
      projectId: d.projectId && originalProjectIds.has(d.projectId) ? ctx.remapId(d.projectId) : null,
      title: d.title,
      slug: d.slug,
      content: d.content,
      storage: 'local',
      createdAt: d.createdAt,
      updatedAt: ts,
    });
  }
}

// ---- Delete ----

async function deleteAllDocsData(ctx: DeletionContext): Promise<DeletionResult> {
  const db = ctx.db as Db;
  let deleted = 0;

  const documentRows = await db
    .select({ id: docsDocuments.id })
    .from(docsDocuments)
    .where(and(eq(docsDocuments.tenantId, ctx.tenantId), eq(docsDocuments.ownerId, ctx.userId)));
  const documentIds = documentRows.map((d) => d.id);

  // Membership rows on the user's own documents, plus the user's own
  // membership rows on documents owned by others. Content lives on the
  // document row itself now (no per-user draft rows to clean up).
  const memberFilter =
    documentIds.length > 0
      ? or(inArray(docsDocumentMembers.documentId, documentIds), eq(docsDocumentMembers.userId, ctx.userId))
      : eq(docsDocumentMembers.userId, ctx.userId);
  const memberRows = await db
    .select({ documentId: docsDocumentMembers.documentId })
    .from(docsDocumentMembers)
    .where(and(eq(docsDocumentMembers.tenantId, ctx.tenantId), memberFilter));
  await db
    .delete(docsDocumentMembers)
    .where(and(eq(docsDocumentMembers.tenantId, ctx.tenantId), memberFilter));
  deleted += memberRows.length;

  deleted += documentRows.length;
  await db
    .delete(docsDocuments)
    .where(and(eq(docsDocuments.tenantId, ctx.tenantId), eq(docsDocuments.ownerId, ctx.userId)));

  const projectRows = await db
    .select({ id: docsProjects.id })
    .from(docsProjects)
    .where(and(eq(docsProjects.tenantId, ctx.tenantId), eq(docsProjects.ownerId, ctx.userId)));
  await db
    .delete(docsProjects)
    .where(and(eq(docsProjects.tenantId, ctx.tenantId), eq(docsProjects.ownerId, ctx.userId)));
  deleted += projectRows.length;

  const driveRows = await db
    .select({ userId: docsDrives.userId })
    .from(docsDrives)
    .where(and(eq(docsDrives.tenantId, ctx.tenantId), eq(docsDrives.userId, ctx.userId)));
  await db
    .delete(docsDrives)
    .where(and(eq(docsDrives.tenantId, ctx.tenantId), eq(docsDrives.userId, ctx.userId)));
  deleted += driveRows.length;

  const prefsRows = await db
    .select({ userId: docsUserPrefs.userId })
    .from(docsUserPrefs)
    .where(and(eq(docsUserPrefs.tenantId, ctx.tenantId), eq(docsUserPrefs.userId, ctx.userId)));
  await db
    .delete(docsUserPrefs)
    .where(and(eq(docsUserPrefs.tenantId, ctx.tenantId), eq(docsUserPrefs.userId, ctx.userId)));
  deleted += prefsRows.length;

  return { deleted };
}
