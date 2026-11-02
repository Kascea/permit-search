import { and, desc, eq, inArray, max, sql } from 'drizzle-orm'

import { withDatabase } from '#/lib/db/client.server'
import { cities, searchRequests, searches } from '#/lib/db/schema'

export interface HistoryItem {
  publicId: string
  permit: string
  city: { name: string; region: string }
  resultCount: number
  // How many times the user ran this search, and when they last did.
  timesSearched: number
  lastSearchedAt: string
}

// The user's searches, one row per saved search, most recent first.
export async function listHistory(userId: string): Promise<Array<HistoryItem>> {
  const lastSearchedAt = max(searchRequests.requestedAt)
  const rows = await withDatabase((db) =>
    db
      .select({
        publicId: searches.publicId,
        permit: searches.permitQuery,
        resultCount: searches.resultCount,
        cityName: cities.name,
        region: cities.region,
        timesSearched: sql<number>`count(*)::int`,
        lastSearchedAt,
      })
      .from(searchRequests)
      .innerJoin(searches, eq(searchRequests.searchId, searches.id))
      .innerJoin(cities, eq(searches.cityId, cities.id))
      .where(eq(searchRequests.userId, userId))
      .groupBy(searches.id, cities.id)
      .orderBy(desc(lastSearchedAt))
      .limit(200),
  )

  return rows.map((row) => ({
    publicId: row.publicId,
    permit: row.permit,
    city: { name: row.cityName, region: row.region },
    resultCount: row.resultCount,
    timesSearched: row.timesSearched,
    lastSearchedAt: (row.lastSearchedAt ?? new Date()).toISOString(),
  }))
}

// Unlinks the user from their requests for one search, or all of them. The
// requests stay for usage counts.
export async function removeHistory(userId: string, publicId?: string) {
  await withDatabase((db) =>
    db
      .update(searchRequests)
      .set({ userId: null })
      .where(
        and(
          eq(searchRequests.userId, userId),
          publicId
            ? inArray(
                searchRequests.searchId,
                db
                  .select({ id: searches.id })
                  .from(searches)
                  .where(eq(searches.publicId, publicId)),
              )
            : undefined,
        ),
      ),
  )
}
