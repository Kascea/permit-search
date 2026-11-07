import { and, count, desc, eq, gt, sql } from 'drizzle-orm'

import { withDatabase } from '#/lib/db/client.server'
import { resultReports, searches } from '#/lib/db/schema'
import { UserError } from '#/lib/errors'

// More reports than this on one search in a day are turned away as spam.
const MAX_REPORTS_PER_SEARCH_PER_DAY = 20

export async function saveResultReport({
  slug,
  message,
}: {
  slug: string
  message: string
}) {
  await withDatabase(async (db) => {
    const search = (
      await db
        .select({ id: searches.id })
        .from(searches)
        .where(eq(searches.slug, slug))
        .orderBy(desc(sql`${searches.resultCount} > 0`), desc(searches.createdAt))
        .limit(1)
    ).at(0)

    if (!search) {
      throw new UserError('That search no longer exists.')
    }

    const dayAgo = new Date(Date.now() - 86_400_000)

    const [{ recent }] = await db
      .select({ recent: count() })
      .from(resultReports)
      .where(
        and(
          eq(resultReports.searchId, search.id),
          gt(resultReports.createdAt, dayAgo),
        ),
      )

    if (recent >= MAX_REPORTS_PER_SEARCH_PER_DAY) {
      throw new UserError(
        'This search has already been reported several times today. Thanks.',
      )
    }

    await db.insert(resultReports).values({ searchId: search.id, message })
  })

  console.log(JSON.stringify({ message: 'results reported', slug }))
}
