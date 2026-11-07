import { and, desc, eq, inArray, max, sql } from 'drizzle-orm'

import type { Database } from '#/lib/db/client.server'
import { cities, searchRequests, searches } from '#/lib/db/schema'

export interface HistoryItem {
  slug: string
  permit: string
  city: { name: string; region: string }
  resultCount: number
  // How many times the user ran this search, and when they last did.
  timesSearched: number
  lastSearchedAt: string
}

// The user's searches, one row per search however often it ran, showing its
// newest run, most recent first.
// Takes the request's open connection (see withUserDatabase).
export async function listHistory(
  db: Database,
  userId: string,
): Promise<Array<HistoryItem>> {
  const lastSearchedAt = max(searchRequests.requestedAt)

  const rows = await db
    .select({
      slug: searches.slug,
      permit: sql<string>`(array_agg(${searches.permitQuery} order by ${searches.createdAt} desc))[1]`,
      resultCount: sql<number>`(array_agg(${searches.resultCount} order by ${searches.createdAt} desc))[1]`,
      cityName: cities.name,
      region: cities.region,
      timesSearched: sql<number>`count(*)::int`,
      lastSearchedAt,
    })
    .from(searchRequests)
    .innerJoin(searches, eq(searchRequests.searchId, searches.id))
    .innerJoin(cities, eq(searches.cityId, cities.id))
    .where(eq(searchRequests.userId, userId))
    .groupBy(searches.slug, cities.id)
    .orderBy(desc(lastSearchedAt))
    .limit(200)

  return rows.map((row) => ({
    slug: row.slug,
    permit: row.permit,
    city: { name: row.cityName, region: row.region },
    resultCount: row.resultCount,
    timesSearched: row.timesSearched,
    lastSearchedAt: (row.lastSearchedAt ?? new Date()).toISOString(),
  }))
}

// Unlinks the user from their requests for one search, or all of them. The
// requests stay for usage counts.
export async function removeHistory(
  db: Database,
  userId: string,
  slug?: string,
) {
  await db
    .update(searchRequests)
    .set({ userId: null })
    .where(
      and(
        eq(searchRequests.userId, userId),
        slug
          ? inArray(
              searchRequests.searchId,
              db
                .select({ id: searches.id })
                .from(searches)
                .where(eq(searches.slug, slug)),
            )
          : undefined,
      ),
    )
}
