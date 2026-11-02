import { and, desc, eq, sql } from 'drizzle-orm'

import { withDatabase } from '#/lib/db/client.server'
import type { Database } from '#/lib/db/client.server'
import { pdfDrafts } from '#/lib/db/schema'
import { draftTitle } from '#/lib/drafts/types'
import type { Draft, DraftSummary } from '#/lib/drafts/types'
import { newPublicId } from '#/lib/saved-searches/search-key'

export async function loadDraft(
  userId: string,
  sourceUrl: string,
): Promise<Draft | null> {
  const row = await withDatabase(async (db) =>
    (
      await db
        .select({
          sourceUrl: pdfDrafts.sourceUrl,
          sourceHash: pdfDrafts.sourceHash,
          content: pdfDrafts.content,
          updatedAt: pdfDrafts.updatedAt,
        })
        .from(pdfDrafts)
        .where(
          and(eq(pdfDrafts.userId, userId), eq(pdfDrafts.sourceUrl, sourceUrl)),
        )
        .limit(1)
    ).at(0),
  )

  return row ? { ...row, updatedAt: row.updatedAt.toISOString() } : null
}

// Saves each draft unless the stored copy was edited more recently, such as
// from another tab or device.
async function upsertDrafts(
  db: Database | Parameters<Parameters<Database['transaction']>[0]>[0],
  userId: string,
  drafts: Array<Draft>,
) {
  for (const draft of drafts) {
    const updatedAt = new Date(draft.updatedAt)
    await db
      .insert(pdfDrafts)
      .values({
        publicId: newPublicId(),
        userId,
        sourceUrl: draft.sourceUrl,
        sourceHash: draft.sourceHash,
        title: draftTitle(draft.sourceUrl),
        content: draft.content,
        createdAt: updatedAt,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [pdfDrafts.userId, pdfDrafts.sourceUrl],
        set: {
          sourceHash: draft.sourceHash,
          content: draft.content,
          updatedAt,
        },
        setWhere: sql`${pdfDrafts.updatedAt} < ${updatedAt}`,
      })
  }
}

export function saveDraft(userId: string, draft: Draft) {
  return withDatabase((db) => upsertDrafts(db, userId, [draft]))
}

export function importDrafts(userId: string, drafts: Array<Draft>) {
  return withDatabase((db) =>
    db.transaction((tx) => upsertDrafts(tx, userId, drafts)),
  )
}

export async function listDrafts(userId: string): Promise<Array<DraftSummary>> {
  const rows = await withDatabase((db) =>
    db
      .select({
        publicId: pdfDrafts.publicId,
        title: pdfDrafts.title,
        sourceUrl: pdfDrafts.sourceUrl,
        updatedAt: pdfDrafts.updatedAt,
      })
      .from(pdfDrafts)
      .where(eq(pdfDrafts.userId, userId))
      .orderBy(desc(pdfDrafts.updatedAt))
      .limit(200),
  )

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function deleteDraft(
  userId: string,
  where: { publicId: string } | { sourceUrl: string },
) {
  await withDatabase((db) =>
    db
      .delete(pdfDrafts)
      .where(
        and(
          eq(pdfDrafts.userId, userId),
          'publicId' in where
            ? eq(pdfDrafts.publicId, where.publicId)
            : eq(pdfDrafts.sourceUrl, where.sourceUrl),
        ),
      ),
  )
}
