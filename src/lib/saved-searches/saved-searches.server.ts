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
import { PERMIT_PROVIDERS, providerForCity } from '#/lib/portals/providers'
import type { OnlineApplicationMatch } from '#/lib/portals/types'
import { matchOnlineApplications } from '#/lib/search/online-applications.server'
import { searchPermitsWithTavily } from '#/lib/search/tavily.server'
import type {
  OnlineApplicationsPreview,
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

// A search that runSavedSearch has started. The online applications come from
// the database and Jev, so they're ready well before the web search; the
// results page shows them while the rest of the search runs.
export interface StartedSearch {
  // Null when a saved search was reused, or the city has no permit portal.
  online: Promise<OnlineApplicationsPreview | null>
  saved: Promise<{ publicId: string; wasReused: boolean }>
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
): Promise<StartedSearch> {
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
              // An empty result is often a bad run of the search, not the
              // city's answer, so it's tried again rather than reused.
              gt(searches.resultCount, 0),
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

    return {
      online: Promise.resolve(null),
      saved: Promise.resolve({ publicId: reused, wasReused: true }),
    }
  }

  const onlineApplications = matchOnlineApplications(input)

  const saved = saveNewSearch(input, {
    fresh,
    queryKey,
    onlineApplications,
    userIdRequest,
  })

  // Observed now for the same reason as userIdRequest; the caller still sees
  // the failure.
  saved.catch(() => {})

  return {
    online: onlineApplications.then((matches) => withPortal(input, matches)),
    saved,
  }
}

// Runs the web search beside the online applications, and saves the response.
async function saveNewSearch(
  input: PermitSearchInput,
  {
    fresh,
    queryKey,
    onlineApplications: onlineApplicationsRequest,
    userIdRequest,
  }: {
    fresh: boolean
    queryKey: string
    onlineApplications: Promise<Array<OnlineApplicationMatch>>
    userIdRequest: Promise<string | null>
  },
): Promise<{ publicId: string; wasReused: boolean }> {
  const region = input.city.region ?? ''

  // The city row doesn't depend on the results, so it's saved during the
  // search. In a city on a supported portal, its online permit types are
  // matched alongside the web search, so they add no wait.
  const [webResponse, onlineApplications, city, userId] = await Promise.all([
    searchPermitsWithTavily(input),
    onlineApplicationsRequest,
    withDatabase((db) => upsertCity(db, { name: input.city.name, region })),
    userIdRequest,
  ])

  const response: PermitSearchResponse = {
    ...webResponse,
    ...withPortal(input, onlineApplications),
  }

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
          resultCount:
            response.results.length +
            (response.onlineApplications?.length ?? 0),
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

// The city's portal and its matched permit types, when it has a portal.
function withPortal(
  input: PermitSearchInput,
  onlineApplications: Array<OnlineApplicationMatch>,
): OnlineApplicationsPreview | null {
  const covering = providerForCity({
    name: input.city.name,
    region: input.city.region ?? '',
  })

  if (!covering) return null

  const provider = PERMIT_PROVIDERS[covering.provider]

  return {
    onlineApplications,
    portal: {
      provider: covering.provider,
      providerName: provider.name,
      applyUrl: provider.applyUrl(covering.jurisdiction),
    },
  }
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

// Just what a breadcrumb or link names a search by, without its results.
export async function loadSearchSummary(
  publicId: string,
): Promise<Pick<SavedSearch, 'publicId' | 'city' | 'permit'> | null> {
  const row = await withDatabase(async (db) =>
    (
      await db
        .select({
          publicId: searches.publicId,
          permit: searches.permitQuery,
          cityName: cities.name,
          region: cities.region,
        })
        .from(searches)
        .innerJoin(cities, eq(searches.cityId, cities.id))
        .where(eq(searches.publicId, publicId))
        .limit(1)
    ).at(0),
  )

  return row
    ? {
        publicId: row.publicId,
        city: { name: row.cityName, region: row.region },
        permit: row.permit,
      }
    : null
}
