'use server';

import { and, eq } from 'drizzle-orm';
import { docsUserPrefs } from '../_db/schema';
import { getContext, now } from './context';

export type DefaultView = 'markdown' | 'wysiwyg';

/** The user's stored default editor view (SPEC.md "Per-user view preference"). Markdown-first when unset. */
export async function getDefaultView(): Promise<DefaultView> {
  const { db, userId, tenantId } = await getContext();
  const [row] = await db
    .select({ defaultView: docsUserPrefs.defaultView })
    .from(docsUserPrefs)
    .where(and(eq(docsUserPrefs.tenantId, tenantId), eq(docsUserPrefs.userId, userId)));
  return row?.defaultView ?? 'markdown';
}

/** Upserts the user's default view preference. Called from the editor's view toggle, not a form. */
export async function setDefaultView(view: DefaultView): Promise<void> {
  const { db, userId, tenantId } = await getContext();
  const ts = now();

  const [existing] = await db
    .select({ userId: docsUserPrefs.userId })
    .from(docsUserPrefs)
    .where(and(eq(docsUserPrefs.tenantId, tenantId), eq(docsUserPrefs.userId, userId)));

  if (existing) {
    await db
      .update(docsUserPrefs)
      .set({ defaultView: view, updatedAt: ts })
      .where(and(eq(docsUserPrefs.tenantId, tenantId), eq(docsUserPrefs.userId, userId)));
  } else {
    await db.insert(docsUserPrefs).values({
      userId,
      tenantId,
      defaultView: view,
      createdAt: ts,
      updatedAt: ts,
    });
  }
}
