import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'

import type { Database } from '#/lib/db/client.server'
import { portalCatalogs, portalPermitTypes } from '#/lib/db/schema'
import {
  PERMIT_PROVIDERS,
  findJurisdiction,
  isPermitProviderId,
} from '#/lib/portals/providers'
import type { Jurisdiction, PermitProviderId } from '#/lib/portals/providers'
import { CATALOG_READERS } from '#/lib/portals/providers.server'
import type { PortalPermitType } from '#/lib/portals/types'

// A jurisdiction's permit types, cached in the database and read again from
// its portal when used after CATALOG_REFRESH_HOURS, like saved searches. A
// failed read keeps what's stored. See docs/search-flow-plan.md.

export const CATALOG_REFRESH_HOURS = 24

// A type a refresh no longer finds is kept for project items, but only types
// seen within this long are offered.
const OFFER_TYPES_SEEN_WITHIN_DAYS = 3

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 3_600_000)
}

const typeColumns = {
  id: portalPermitTypes.id,
  provider: portalPermitTypes.provider,
  jurisdiction: portalPermitTypes.jurisdiction,
  externalId: portalPermitTypes.externalId,
  name: portalPermitTypes.name,
  category: portalPermitTypes.category,
  plansRequired: portalPermitTypes.plansRequired,
  pageUrl: portalPermitTypes.pageUrl,
  applyUrl: portalPermitTypes.applyUrl,
  requirements: portalPermitTypes.requirements,
  requirementsFetchedAt: portalPermitTypes.requirementsFetchedAt,
}

type TypeRow = Pick<
  typeof portalPermitTypes.$inferSelect,
  keyof typeof typeColumns
>

export function toPortalPermitType(
  row: TypeRow,
  provider: PermitProviderId,
  jurisdiction: Jurisdiction,
): PortalPermitType {
  return {
    id: row.id,
    provider,
    providerName: PERMIT_PROVIDERS[provider].name,
    jurisdiction: jurisdiction.code,
    city: jurisdiction.city,
    name: row.name,
    category: row.category,
    plansRequired: row.plansRequired,
    pageUrl: row.pageUrl,
    applyUrl: row.applyUrl,
    requirements: row.requirements,
  }
}

// Reads the jurisdiction's list from its portal when the stored one is
// missing or older than a day. Never throws for the portal's sake: a failed
// read is recorded and the stored list, if any, is used.
async function refreshCatalogIfStale(
  db: Database,
  provider: PermitProviderId,
  jurisdiction: Jurisdiction,
) {
  const reader = CATALOG_READERS[provider]

  if (!reader) return

  const [catalog] = await db
    .select({ expiresAt: portalCatalogs.expiresAt })
    .from(portalCatalogs)
    .where(
      and(
        eq(portalCatalogs.provider, provider),
        eq(portalCatalogs.jurisdiction, jurisdiction.code),
      ),
    )

  if (catalog && catalog.expiresAt > new Date()) return

  try {
    const types = await reader.listPermitTypes(jurisdiction)
    const now = new Date()

    if (types.length > 0) {
      await db
        .insert(portalPermitTypes)
        .values(
          types.map((type) => ({
            provider,
            jurisdiction: jurisdiction.code,
            ...type,
            seenAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [
            portalPermitTypes.provider,
            portalPermitTypes.jurisdiction,
            portalPermitTypes.externalId,
          ],
          set: {
            name: sql`excluded.name`,
            category: sql`excluded.category`,
            plansRequired: sql`excluded.plans_required`,
            pageUrl: sql`excluded.page_url`,
            applyUrl: sql`excluded.apply_url`,
            feeEstimatorUrl: sql`excluded.fee_estimator_url`,
            details: sql`excluded.details`,
            seenAt: now,
            updatedAt: now,
          },
        })
    }

    await db
      .insert(portalCatalogs)
      .values({
        provider,
        jurisdiction: jurisdiction.code,
        fetchedAt: now,
        expiresAt: hoursFromNow(CATALOG_REFRESH_HOURS),
        typeCount: types.length,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: [portalCatalogs.provider, portalCatalogs.jurisdiction],
        set: {
          fetchedAt: now,
          expiresAt: hoursFromNow(CATALOG_REFRESH_HOURS),
          typeCount: types.length,
          lastError: null,
          updatedAt: now,
        },
      })

    console.log(
      JSON.stringify({
        message: 'portal catalog refreshed',
        provider,
        jurisdiction: jurisdiction.code,
        types: types.length,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error(
      JSON.stringify({
        message: 'portal catalog refresh failed',
        provider,
        jurisdiction: jurisdiction.code,
        error: message,
      }),
    )

    // Tried again on the next search after an hour, not straight away, so a
    // portal that's down isn't asked on every search.
    await db
      .insert(portalCatalogs)
      .values({
        provider,
        jurisdiction: jurisdiction.code,
        expiresAt: hoursFromNow(1),
        lastError: message.slice(0, 500),
      })
      .onConflictDoUpdate({
        target: [portalCatalogs.provider, portalCatalogs.jurisdiction],
        set: {
          expiresAt: hoursFromNow(1),
          lastError: message.slice(0, 500),
          updatedAt: new Date(),
        },
      })
  }
}

// The jurisdiction's current permit types, refreshing the stored list first
// when it's stale.
export async function loadCatalog(
  db: Database,
  provider: PermitProviderId,
  jurisdiction: Jurisdiction,
): Promise<Array<PortalPermitType>> {
  await refreshCatalogIfStale(db, provider, jurisdiction)

  const seenSince = new Date(
    Date.now() - OFFER_TYPES_SEEN_WITHIN_DAYS * 24 * 3_600_000,
  )

  const rows = await db
    .select(typeColumns)
    .from(portalPermitTypes)
    .where(
      and(
        eq(portalPermitTypes.provider, provider),
        eq(portalPermitTypes.jurisdiction, jurisdiction.code),
        gte(portalPermitTypes.seenAt, seenSince),
      ),
    )
    .orderBy(portalPermitTypes.category, portalPermitTypes.name)

  return rows.map((row) => toPortalPermitType(row, provider, jurisdiction))
}

// Fills in requirements for these types, reading any that are missing or
// older than a day. A failed read leaves the type's stored requirements.
export async function withRequirements<Type extends PortalPermitType>(
  db: Database,
  provider: PermitProviderId,
  jurisdiction: Jurisdiction,
  types: Array<Type>,
): Promise<Array<Type>> {
  const reader = CATALOG_READERS[provider]

  if (!reader || types.length === 0) return types

  const staleBefore = new Date(Date.now() - CATALOG_REFRESH_HOURS * 3_600_000)

  const stale = await db
    .select({
      id: portalPermitTypes.id,
      externalId: portalPermitTypes.externalId,
    })
    .from(portalPermitTypes)
    .where(
      and(
        inArray(
          portalPermitTypes.id,
          types.map((type) => type.id),
        ),
        sql`(${portalPermitTypes.requirementsFetchedAt} is null or ${lt(
          portalPermitTypes.requirementsFetchedAt,
          staleBefore,
        )})`,
      ),
    )

  const read = await Promise.all(
    stale.map(async (row) => {
      try {
        const requirements = await reader.readRequirements(
          jurisdiction,
          row.externalId,
        )

        await db
          .update(portalPermitTypes)
          .set({ requirements, requirementsFetchedAt: new Date() })
          .where(eq(portalPermitTypes.id, row.id))

        return [row.id, requirements] as const
      } catch (error) {
        console.error(
          JSON.stringify({
            message: 'permit requirements read failed',
            provider,
            jurisdiction: jurisdiction.code,
            externalId: row.externalId,
            error: error instanceof Error ? error.message : String(error),
          }),
        )

        return null
      }
    }),
  )

  const fresh = new Map(read.filter((entry) => entry !== null))

  return types.map((type) => ({
    ...type,
    requirements: fresh.get(type.id) ?? type.requirements,
  }))
}

// One stored type by ID, for adding it to a project; null when unknown.
export async function findPortalPermitType(
  db: Database,
  id: number,
): Promise<PortalPermitType | null> {
  const [row] = await db
    .select(typeColumns)
    .from(portalPermitTypes)
    .where(eq(portalPermitTypes.id, id))

  if (!row) return null

  if (!isPermitProviderId(row.provider)) return null

  const jurisdiction = findJurisdiction(row.provider, row.jurisdiction)

  return jurisdiction ? toPortalPermitType(row, row.provider, jurisdiction) : null
}
