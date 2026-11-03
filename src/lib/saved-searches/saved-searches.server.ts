import { and, desc, eq, gt, sql } from 'drizzle-orm'

import { upsertCity } from '#/lib/contacts/store.server'
import { withDatabase } from '#/lib/db/client.server'
import { cities, searchRequests, searches } from '#/lib/db/schema'
import {
  SEARCH_PIPELINE_VERSION,
  SEARCH_REFRESH_HOURS,
  SEARCH_REUSE_DAYS,
  newPublicId,
  normalizeQuery,
  searchKey,
} from '#/lib/saved-searches/search-key'
import { searchPermitsWithTavily } from '#/lib/search/tavily.server'
import type {
  PermitSearchInput,
  PermitSearchResponse,
} from '#/lib/search/types'

export interface SavedSearch {
  publicId: string
  city: { name: string; region: string }
  permit: string
  response: PermitSearchResponse
  createdAt: string
  // Measured on the server when loaded, so the server and browser render the
  // same "New" or "Saved" label.
  ageMinutes: number
}

// Reuses a matching search from the last SEARCH_REUSE_DAYS when there is one;
// otherwise runs the search and saves it. `fresh` runs it again unless it
// already ran in the last SEARCH_REFRESH_HOURS. `userId` records who ran it, for
// their history; it may still be resolving, and is awaited only when needed.
export async function runSavedSearch(
  input: PermitSearchInput,
  {
    fresh = false,
    userId: pendingUserId = null,
  }: {
    fresh?: boolean
    userId?: string | null | Promise<string | null>
  } = {},
): Promise<{ publicId: string; wasReused: boolean }> {
  const userIdRequest = Promise.resolve(pendingUserId)
  // Observed now so a failure while looking up the search isn't reported as
  // an unhandled rejection; awaiting it below still throws.
  userIdRequest.catch(() => {})

  const region = input.city.region ?? ''
  const queryKey = searchKey(input.city.name, region, input.permit)
  const refreshCutoff = new Date(Date.now() - SEARCH_REFRESH_HOURS * 3_600_000)

  const reused = await withDatabase(async (db) => {
    // Counting the reuse and recording the request succeed or fail together.
    return db.transaction(async (tx) => {
      const match = (
        await tx
          .select({ id: searches.id, publicId: searches.publicId })
          .from(searches)
          .where(
            and(
              eq(searches.queryKey, queryKey),
              gt(searches.reuseUntil, new Date()),
              fresh ? gt(searches.createdAt, refreshCutoff) : undefined,
            ),
          )
          .orderBy(desc(searches.createdAt))
          .limit(1)
      ).at(0)
      if (!match) {
        return null
      }

      await tx
        .update(searches)
        .set({
          timesServed: sql`${searches.timesServed} + 1`,
          lastServedAt: new Date(),
        })
        .where(eq(searches.id, match.id))
      await tx.insert(searchRequests).values({
        searchId: match.id,
        wasReused: true,
        userId: await userIdRequest,
      })
      return match.publicId
    })
  })

  if (reused) {
    console.log(
      JSON.stringify({
        message: 'reused saved search',
        queryKey,
        publicId: reused,
      }),
    )
    return { publicId: reused, wasReused: true }
  }

  // The city row doesn't depend on the results, so it's saved during the search.
  const [response, city, userId] = await Promise.all([
    searchPermitsWithTavily(input),
    withDatabase((db) => upsertCity(db, { name: input.city.name, region })),
    userIdRequest,
  ])
  const reuseUntil = new Date()
  reuseUntil.setUTCDate(reuseUntil.getUTCDate() + SEARCH_REUSE_DAYS)

  const publicId = await withDatabase((db) =>
    db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(searches)
        .values({
          publicId: newPublicId(),
          cityId: city.id,
          permitQuery: input.permit,
          normalizedQuery: normalizeQuery(input.permit),
          queryKey,
          pipelineVersion: SEARCH_PIPELINE_VERSION,
          permitTypes: response.permitTypes,
          response,
          resultCount: response.results.length,
          reuseUntil,
        })
        .returning({ id: searches.id, publicId: searches.publicId })
      await tx
        .insert(searchRequests)
        .values({ searchId: saved.id, wasReused: false, userId })
      return saved.publicId
    }),
  )

  console.log(
    JSON.stringify({ message: 'saved new search', queryKey, publicId, fresh }),
  )
  return { publicId, wasReused: false }
}

export async function loadSavedSearch(
  publicId: string,
): Promise<SavedSearch | null> {
  const row = await withDatabase(async (db) =>
    (
      await db
        .select({
          publicId: searches.publicId,
          permit: searches.permitQuery,
          response: searches.response,
          createdAt: searches.createdAt,
          cityName: cities.name,
          region: cities.region,
        })
        .from(searches)
        .innerJoin(cities, eq(searches.cityId, cities.id))
        .where(eq(searches.publicId, publicId))
        .limit(1)
    ).at(0),
  )
  if (!row) {
    return null
  }

  return {
    publicId: row.publicId,
    city: { name: row.cityName, region: row.region },
    permit: row.permit,
    response: row.response,
    createdAt: row.createdAt.toISOString(),
    ageMinutes: Math.floor((Date.now() - row.createdAt.getTime()) / 60_000),
  }
}
