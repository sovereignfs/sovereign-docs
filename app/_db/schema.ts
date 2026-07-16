import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Runtime query schema for Sovereign Docs.
 *
 * This file intentionally lives under app/ because the Sovereign runtime mounts
 * the plugin app tree into Next routes. Server components/actions must not
 * import runtime query helpers from outside that mounted tree. `db/schema.ts`
 * re-exports this file for tooling (drizzle-kit).
 *
 * `database.isolation: "isolated"` (see manifest.json) — no slug prefix is
 * required, but table names keep the `docs_` prefix from SPEC.md for
 * readability and consistency with the doc's data model table.
 *
 * No `docs_credentials` table: the git token itself is stored via
 * `sdk.secrets`, and connection metadata/lifecycle via `sdk.connections`
 * (RFC 0049) — `docs_drives` only keeps the `connection_id` reference plus
 * the fields (`branch`, `base_path`) that are read on every git call and
 * shouldn't require a round trip through `sdk.connections`. See SPEC.md
 * "Credentials & connection lifecycle".
 */

export const docsDrives = sqliteTable('docs_drives', {
  userId: text('user_id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  connectionId: text('connection_id').notNull(),
  branch: text('branch').notNull(),
  basePath: text('base_path').notNull().default('docs'),
  createdAt: integer('created_at').notNull(),
});

export const docsProjects = sqliteTable('docs_projects', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const docsDocuments = sqliteTable('docs_documents', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  ownerId: text('owner_id').notNull(),
  projectId: text('project_id'),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  status: text('status', { enum: ['draft', 'published'] })
    .notNull()
    .default('draft'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const docsDrafts = sqliteTable(
  'docs_drafts',
  {
    documentId: text('document_id').notNull(),
    userId: text('user_id').notNull(),
    tenantId: text('tenant_id').notNull(),
    content: text('content').notNull().default(''),
    baseSha: text('base_sha'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.userId] })],
);

export const docsDocumentMembers = sqliteTable(
  'docs_document_members',
  {
    documentId: text('document_id').notNull(),
    userId: text('user_id').notNull(),
    tenantId: text('tenant_id').notNull(),
    role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(),
    invitedBy: text('invited_by'),
    joinedAt: integer('joined_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.userId] }),
    uniqueIndex('docs_document_members_document_user_idx').on(t.documentId, t.userId),
  ],
);

export const docsTables = {
  docsDrives,
  docsProjects,
  docsDocuments,
  docsDrafts,
  docsDocumentMembers,
};

export type DocsDrive = InferSelectModel<typeof docsDrives>;
export type DocsProject = InferSelectModel<typeof docsProjects>;
export type DocsDocument = InferSelectModel<typeof docsDocuments>;
export type DocsDraft = InferSelectModel<typeof docsDrafts>;
export type DocsDocumentMember = InferSelectModel<typeof docsDocumentMembers>;
export type NewDocsDrive = InferInsertModel<typeof docsDrives>;
export type NewDocsProject = InferInsertModel<typeof docsProjects>;
export type NewDocsDocument = InferInsertModel<typeof docsDocuments>;
export type NewDocsDraft = InferInsertModel<typeof docsDrafts>;
export type NewDocsDocumentMember = InferInsertModel<typeof docsDocumentMembers>;
