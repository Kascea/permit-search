import { withDatabase } from '#/lib/db/client.server'
import { loadCatalog, withRequirements } from '#/lib/portals/catalog.server'
import { PERMIT_PROVIDERS, providerForCity } from '#/lib/portals/providers'
import type { OnlineApplicationMatch } from '#/lib/portals/types'
import { pickMatches, scoreTypes } from '#/lib/search/online-applications'
import { createTypeSafeClient } from '#/lib/search/typesafe.server'
import type { PermitSearchInput } from '#/lib/search/types'

// In a city on a supported permit portal, the city's own online permit types
// that the project needs. See docs/search-flow-plan.md.

// Never throws: the portal adds to a search, and a search never fails for
// its sake. No supported provider, an unreadable catalog or a failed Jev call
// all give no matches.
export async function matchOnlineApplications(
  input: PermitSearchInput,
): Promise<Array<OnlineApplicationMatch>> {
  const covering = providerForCity({
    name: input.city.name,
    region: input.city.region ?? '',
  })

  if (!covering || !PERMIT_PROVIDERS[covering.provider].capabilities.catalog) {
    return []
  }

  const { provider, jurisdiction } = covering

  try {
    return await withDatabase(async (db) => {
      const catalog = await loadCatalog(db, provider, jurisdiction)

      if (catalog.length === 0) return []

      const scored = await scoreTypes(
        createTypeSafeClient(),
        input.permit,
        catalog,
      )

      const matches = pickMatches(scored)

      console.log(
        JSON.stringify({
          message: 'matched online permit types',
          provider,
          jurisdiction: jurisdiction.code,
          project: input.permit,
          catalogSize: catalog.length,
          matches: matches.map(({ type, score }) => ({
            name: type.name,
            score: Math.round(score * 100) / 100,
          })),
        }),
      )

      return withRequirements(
        db,
        provider,
        jurisdiction,
        matches.map(({ type, score }) => ({ ...type, score })),
      )
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'online permit type matching failed',
        provider,
        jurisdiction: jurisdiction.code,
        error: error instanceof Error ? error.message : String(error),
      }),
    )

    return []
  }
}
