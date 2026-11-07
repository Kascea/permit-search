import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import type { Database } from '#/lib/db/client.server'
import {
  cities,
  pdfDrafts,
  projectItems,
  projects,
  searches,
} from '#/lib/db/schema'
import { draftTitle } from '#/lib/drafts/types'
import type { Draft, DraftSummary } from '#/lib/drafts/types'
import { searchLinkFromColumns } from '#/lib/navigation/origin'
import { searchRunColumn } from '#/lib/saved-searches/search-run.server'
import { newPublicId } from '#/lib/saved-searches/search-key'

// Each function takes the request's open connection (see withUserDatabase), so
// checking the session and the work share one connection.

// The PDF form with this URL in one of the user's projects, or undefined when
// that project doesn't hold it.
async function findProjectForm(
  db: Database,
  userId: string,
  projectId: string,
  sourceUrl: string,
) {
  const items = await db
    .select({ id: projectItems.id, filedAt: projectItems.filedAt })
    .from(projectItems)
    .innerJoin(projects, eq(projects.id, projectItems.projectId))
    .where(
      and(
        eq(projects.userId, userId),
        eq(projects.publicId, projectId),
        eq(projectItems.sourceUrl, sourceUrl),
        eq(projectItems.kind, 'pdf'),
      ),
    )

  return items.at(0)
}

// Which row a form's draft is: the project form's, or the user's one draft for
// that URL outside a project.
function draftScope(
  userId: string,
  sourceUrl: string,
  item: { id: number } | undefined,
) {
  return item
    ? eq(pdfDrafts.projectItemId, item.id)
    : and(
        eq(pdfDrafts.userId, userId),
        eq(pdfDrafts.sourceUrl, sourceUrl),
        isNull(pdfDrafts.projectItemId),
      )
}

// The draft of a project's copy of a form, or of the copy outside a project
// when no project is given or that project doesn't hold the form. projectId
// says which it was, so later saves go to the same place. isFiled says the form
// has gone to the city.
export async function loadDraft(
  db: Database,
  userId: string,
  sourceUrl: string,
  projectId: string | undefined,
): Promise<{
  draft: Draft | null
  projectId: string | undefined
  isFiled: boolean
}> {
  const item = projectId
    ? await findProjectForm(db, userId, projectId, sourceUrl)
    : undefined

  const scope = item ? projectId : undefined

  const row = (
    await db
      .select({
        sourceUrl: pdfDrafts.sourceUrl,
        sourceHash: pdfDrafts.sourceHash,
        content: pdfDrafts.content,
        name: pdfDrafts.name,
        updatedAt: pdfDrafts.updatedAt,
      })
      .from(pdfDrafts)
      .where(draftScope(userId, sourceUrl, item))
      .limit(1)
  ).at(0)

  return {
    projectId: scope,
    isFiled: Boolean(item?.filedAt),
    draft: row
      ? {
          ...row,
          projectId: scope,
          name: row.name ?? undefined,
          updatedAt: row.updatedAt.toISOString(),
        }
      : null,
  }
}

// Saves each draft unless the stored copy was edited more recently, such as
// from another tab or device. A draft whose project no longer holds its form
// is saved outside a project, so the answers aren't lost.
async function upsertDrafts(
  db: Database,
  userId: string,
  drafts: Array<Draft>,
) {
  for (const draft of drafts) {
    const updatedAt = new Date(draft.updatedAt)

    const item = draft.projectId
      ? await findProjectForm(db, userId, draft.projectId, draft.sourceUrl)
      : undefined

    const insert = db.insert(pdfDrafts).values({
      publicId: newPublicId(),
      userId,
      sourceUrl: draft.sourceUrl,
      projectItemId: item?.id,
      sourceHash: draft.sourceHash,
      title: draftTitle(draft.sourceUrl),
      content: draft.content,
      // Null when no search has that slug.
      searchId: searchRunColumn(searches.id, draft.searchSlug),
      createdAt: updatedAt,
      updatedAt,
    })

    const set = {
      sourceHash: draft.sourceHash,
      content: draft.content,
      // Keeps the search it was first opened from.
      searchId: sql`coalesce(${pdfDrafts.searchId}, excluded.search_id)`,
      updatedAt,
    }

    const setWhere = sql`${pdfDrafts.updatedAt} < ${updatedAt}`

    await (item
      ? insert.onConflictDoUpdate({
          target: pdfDrafts.projectItemId,
          set,
          setWhere,
        })
      : insert.onConflictDoUpdate({
          target: [pdfDrafts.userId, pdfDrafts.sourceUrl],
          targetWhere: isNull(pdfDrafts.projectItemId),
          set,
          setWhere,
        }))
  }
}

export function saveDraft(db: Database, userId: string, draft: Draft) {
  return upsertDrafts(db, userId, [draft])
}

export function importDrafts(
  db: Database,
  userId: string,
  drafts: Array<Draft>,
) {
  return db.transaction((tx) => upsertDrafts(tx, userId, drafts))
}

export async function listDrafts(
  db: Database,
  userId: string,
): Promise<Array<DraftSummary>> {
  const rows = await db
    .select({
      publicId: pdfDrafts.publicId,
      title: pdfDrafts.title,
      name: pdfDrafts.name,
      sourceUrl: pdfDrafts.sourceUrl,
      projectId: projects.publicId,
      updatedAt: pdfDrafts.updatedAt,
      searchSlug: searches.slug,
      permit: searches.permitQuery,
      cityName: cities.name,
      region: cities.region,
    })
    .from(pdfDrafts)
    .leftJoin(searches, eq(pdfDrafts.searchId, searches.id))
    .leftJoin(cities, eq(searches.cityId, cities.id))
    .leftJoin(projectItems, eq(pdfDrafts.projectItemId, projectItems.id))
    .leftJoin(projects, eq(projectItems.projectId, projects.id))
    .where(eq(pdfDrafts.userId, userId))
    .orderBy(desc(pdfDrafts.updatedAt))
    .limit(200)

  return rows.map((row) => ({
    publicId: row.publicId,
    title: row.title,
    name: row.name ?? undefined,
    sourceUrl: row.sourceUrl,
    projectId: row.projectId ?? undefined,
    updatedAt: row.updatedAt.toISOString(),
    search: searchLinkFromColumns(row),
  }))
}

// Null goes back to the form's title. The edit time is left alone: it's the
// time of the last change to the answers, which decides which copy of a draft
// wins when two are saved.
export async function renameDraft(
  db: Database,
  userId: string,
  publicId: string,
  name: string | null,
) {
  await db
    .update(pdfDrafts)
    .set({ name, updatedAt: sql`${pdfDrafts.updatedAt}` })
    .where(and(eq(pdfDrafts.userId, userId), eq(pdfDrafts.publicId, publicId)))
}

export async function deleteDraft(
  db: Database,
  userId: string,
  where: { publicId: string } | { sourceUrl: string; projectId?: string },
) {
  if ('publicId' in where) {
    await db
      .delete(pdfDrafts)
      .where(
        and(eq(pdfDrafts.userId, userId), eq(pdfDrafts.publicId, where.publicId)),
      )

    return
  }

  const item = where.projectId
    ? await findProjectForm(db, userId, where.projectId, where.sourceUrl)
    : undefined

  await db
    .delete(pdfDrafts)
    .where(
      and(
        eq(pdfDrafts.userId, userId),
        draftScope(userId, where.sourceUrl, item),
      ),
    )
}
