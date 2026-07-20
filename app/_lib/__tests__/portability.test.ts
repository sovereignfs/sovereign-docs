import { getTableName, type Table } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DeletionContext,
  ExportContext,
  ImportContext,
  PluginExportSection,
} from '@sovereignfs/sdk';

type Row = Record<string, unknown>;
type Condition =
  | { kind: 'eq'; key: string; value: unknown }
  | { kind: 'and'; conditions: Condition[] }
  | { kind: 'or'; conditions: Condition[] };

function toCamel(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_match, c: string) => c.toUpperCase());
}

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: { name: string }, value: unknown): Condition => ({
      kind: 'eq',
      key: toCamel(column.name),
      value,
    }),
    and: (...conditions: Condition[]): Condition => ({ kind: 'and', conditions }),
    or: (...conditions: Condition[]): Condition => ({ kind: 'or', conditions }),
    inArray: (column: { name: string }, values: unknown[]): Condition => ({
      kind: 'eq',
      key: toCamel(column.name),
      value: values,
    }),
  };
});

function matches(row: Row, condition?: Condition): boolean {
  if (!condition) return true;
  if (condition.kind === 'eq') {
    if (Array.isArray(condition.value)) return condition.value.includes(row[condition.key]);
    return row[condition.key] === condition.value;
  }
  if (condition.kind === 'and') return condition.conditions.every((c) => matches(row, c));
  return condition.conditions.some((c) => matches(row, c));
}

const capturedExporter = { fn: null as ((ctx: ExportContext) => Promise<PluginExportSection>) | null };
const capturedImporter = {
  fn: null as ((section: PluginExportSection, ctx: ImportContext) => Promise<void>) | null,
};
const capturedDeleter = {
  fn: null as ((ctx: DeletionContext) => Promise<{ deleted: number; errors?: string[] }>) | null,
};

vi.mock('@sovereignfs/sdk', () => ({
  sdk: {
    db: { getClient: vi.fn(async () => fakeDb) },
    portability: {
      provideExport: vi.fn(async (fn: typeof capturedExporter.fn) => {
        capturedExporter.fn = fn;
      }),
      provideImport: vi.fn(async (fn: typeof capturedImporter.fn) => {
        capturedImporter.fn = fn;
      }),
      provideDelete: vi.fn(async (fn: typeof capturedDeleter.fn) => {
        capturedDeleter.fn = fn;
      }),
    },
  },
}));

interface Store extends Record<string, Row[]> {
  docs_drives: Row[];
  docs_projects: Row[];
  docs_documents: Row[];
  docs_user_prefs: Row[];
  docs_document_members: Row[];
}

let store: Store = {
  docs_drives: [],
  docs_projects: [],
  docs_documents: [],
  docs_user_prefs: [],
  docs_document_members: [],
};

function resetStore() {
  store = {
    docs_drives: [],
    docs_projects: [],
    docs_documents: [],
    docs_user_prefs: [],
    docs_document_members: [],
  };
}

const fakeDb = {
  select(columns?: Record<string, unknown>) {
    return {
      from(table: Table) {
        const tableName = getTableName(table);
        return {
          where: async (condition?: Condition) => {
            const rows = (store[tableName] ?? []).filter((row) => matches(row, condition));
            if (!columns) return rows;
            return rows.map((row) => {
              const projected: Row = {};
              for (const key of Object.keys(columns)) projected[key] = row[key];
              return projected;
            });
          },
        };
      },
    };
  },
  insert(table: Table) {
    const tableName = getTableName(table);
    return {
      values: async (row: Row) => {
        (store[tableName] ??= []).push(row);
      },
    };
  },
  delete(table: Table) {
    const tableName = getTableName(table);
    return {
      where: async (condition?: Condition) => {
        store[tableName] = (store[tableName] ?? []).filter((row) => !matches(row, condition));
      },
    };
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe('portability export', () => {
  it("exports only the user's own projects and documents (content inline), with a warning about the drive", async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    store.docs_drives = [{ userId: 'u1', tenantId: 't1', connectionId: 'conn-1', branch: 'main', basePath: 'docs', createdAt: 1 }];
    store.docs_projects = [
      { id: 'proj-1', tenantId: 't1', ownerId: 'u1', name: 'Handbook', slug: 'handbook', createdAt: 1 },
      { id: 'proj-2', tenantId: 't1', ownerId: 'other', name: 'Not mine', slug: 'not-mine', createdAt: 1 },
    ];
    store.docs_documents = [
      { id: 'doc-1', tenantId: 't1', ownerId: 'u1', projectId: 'proj-1', title: 'Onboarding', slug: 'onboarding', content: 'Hello', storage: 'local', gitPath: null, baseSha: null, syncStatus: null, lastSyncedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'doc-2', tenantId: 't1', ownerId: 'other', projectId: 'proj-2', title: 'Not mine', slug: 'not-mine', content: 'nope', storage: 'local', gitPath: null, baseSha: null, syncStatus: null, lastSyncedAt: null, createdAt: 1, updatedAt: 1 },
    ];

    const section = await capturedExporter.fn?.({
      userId: 'u1',
      tenantId: 't1',
      options: { includeFiles: true },
    });
    expect(section).toBeDefined();
    expect((section as PluginExportSection).schemaVersion).toBe(2);

    const data = (section as PluginExportSection).data as {
      drive: { branch: string } | null;
      projects: { id: string }[];
      documents: { id: string; content: string; storage: string }[];
    };
    expect(data.drive?.branch).toBe('main');
    expect(data.projects.map((p) => p.id)).toEqual(['proj-1']);
    expect(data.documents.map((d) => d.id)).toEqual(['doc-1']);
    expect(data.documents[0]).toMatchObject({ content: 'Hello', storage: 'local' });
    expect((section as PluginExportSection).warnings?.length).toBeGreaterThan(0);
  });
});

describe('portability import', () => {
  it('remaps a document to its project, scopes it to the importing user as a local doc, without re-creating the drive', async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    const section: PluginExportSection = {
      pluginId: 'fs.sovereign.docs',
      schemaVersion: 2,
      data: {
        drive: { branch: 'main', basePath: 'docs', createdAt: 1 },
        projects: [{ id: 'src-proj-1', name: 'Handbook', slug: 'handbook', createdAt: 1 }],
        documents: [
          { id: 'src-doc-1', projectId: 'src-proj-1', title: 'Onboarding', slug: 'onboarding', content: 'Hello', storage: 'git', createdAt: 1, updatedAt: 1 },
        ],
        documentMembers: [],
      },
    };

    await capturedImporter.fn?.(section, { userId: 'u2', tenantId: 't1', remapId: (id) => `new-${id}` });

    expect(store.docs_projects).toEqual([
      expect.objectContaining({ id: 'new-src-proj-1', ownerId: 'u2', tenantId: 't1' }),
    ]);
    // A git-backed document is imported as local (its remote mirror is not re-created), content preserved.
    expect(store.docs_documents).toEqual([
      expect.objectContaining({
        id: 'new-src-doc-1',
        projectId: 'new-src-proj-1',
        ownerId: 'u2',
        content: 'Hello',
        storage: 'local',
      }),
    ]);
    expect(store.docs_drives).toEqual([]);
  });

  it('rejects an export section with a stale schema version', async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    const section: PluginExportSection = {
      pluginId: 'fs.sovereign.docs',
      schemaVersion: 1,
      data: { drive: null, projects: [], documents: [], documentMembers: [] },
    };

    await expect(
      capturedImporter.fn?.(section, { userId: 'u2', tenantId: 't1', remapId: (id) => `new-${id}` }),
    ).rejects.toThrow(/unrecognized shape/);
  });
});

describe('portability delete', () => {
  it("deletes only the user's own projects, documents, memberships, drive, and view preferences", async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    store.docs_drives = [{ userId: 'u1', tenantId: 't1', connectionId: 'conn-1', branch: 'main', basePath: 'docs', createdAt: 1 }];
    store.docs_projects = [{ id: 'proj-1', tenantId: 't1', ownerId: 'u1', name: 'Mine', slug: 'mine', createdAt: 1 }];
    store.docs_documents = [
      { id: 'doc-1', tenantId: 't1', ownerId: 'u1', projectId: 'proj-1', title: 'Mine', slug: 'mine', content: 'a', storage: 'local', createdAt: 1, updatedAt: 1 },
      { id: 'doc-2', tenantId: 't1', ownerId: 'other', projectId: null, title: 'Not mine', slug: 'not-mine', content: 'b', storage: 'local', createdAt: 1, updatedAt: 1 },
    ];
    store.docs_user_prefs = [
      { userId: 'u1', tenantId: 't1', defaultView: 'wysiwyg', createdAt: 1, updatedAt: 1 },
      { userId: 'other', tenantId: 't1', defaultView: 'markdown', createdAt: 1, updatedAt: 1 },
    ];
    store.docs_document_members = [
      { documentId: 'doc-1', userId: 'other', tenantId: 't1', role: 'viewer', invitedBy: 'u1', joinedAt: 1 },
      { documentId: 'doc-2', userId: 'u1', tenantId: 't1', role: 'viewer', invitedBy: 'other', joinedAt: 1 },
    ];

    const result = await capturedDeleter.fn?.({ userId: 'u1', tenantId: 't1', db: fakeDb });
    expect(result).toBeDefined();

    expect(store.docs_projects).toEqual([]);
    expect(store.docs_documents).toEqual([expect.objectContaining({ id: 'doc-2' })]);
    expect(store.docs_document_members).toEqual([]);
    expect(store.docs_drives).toEqual([]);
    // The user's own preference row is removed; another user's is left intact.
    expect(store.docs_user_prefs).toEqual([expect.objectContaining({ userId: 'other' })]);
    expect(result?.deleted).toBeGreaterThan(0);
  });
});
