import { and, asc, eq, sql } from 'drizzle-orm'

import type { Database } from '#/lib/db/client.server'
import {
  blankPdfs,
  cities,
  portalPermitTypes,
  projectItems,
  projects,
  savedPermits,
  searches,
} from '#/lib/db/schema'
import { UserError } from '#/lib/errors'
import { searchLinkFromColumns } from '#/lib/navigation/origin'
import { searchRunColumn } from '#/lib/saved-searches/search-run.server'
import { storeBlankPdf } from '#/lib/pdf/blank-pdf.server'
import {
  findPortalPermitType,
  portalPermitTypeFromRow,
  typeColumns,
} from '#/lib/portals/catalog.server'
import { fetchPdfBytes } from '#/lib/pdf/fetch-pdf.server'
import { MAX_PERMIT_TITLE_LENGTH } from '#/lib/permits/types'
import type {
  SavePermitInput,
  SavedPermit,
  SavedPermitChanges,
} from '#/lib/permits/types'
import { newPublicId } from '#/lib/saved-searches/search-key'

// Each function takes the request's open connection (see withUserDatabase).

const MAX_SAVED_PERMITS = 500

function ownedBy(userId: string, publicId: string) {
  return and(
    eq(savedPermits.userId, userId),
    eq(savedPermits.publicId, publicId),
  )
}

// Grouped by city, then by title. With a public ID, just that permit (if it's
// the user's). Online permits whose provider or city is no longer supported
// are left out.
export async function listSavedPermits(
  db: Database,
  userId: string,
  publicId?: string,
): Promise<Array<SavedPermit>> {
  const rows = await db
    .select({
      publicId: savedPermits.publicId,
      title: savedPermits.title,
      cityName: savedPermits.cityName,
      cityRegion: savedPermits.cityRegion,
      permitTypes: savedPermits.permitTypes,
      sourceUrl: savedPermits.sourceUrl,
      sourceHash: savedPermits.sourceHash,
      notes: savedPermits.notes,
      savedAt: savedPermits.createdAt,
      versionSavedAt: savedPermits.versionSavedAt,
      pdf: {
        pageCount: blankPdfs.pageCount,
        fieldCount: blankPdfs.fieldCount,
        pdfModifiedAt: blankPdfs.pdfModifiedAt,
      },
      type: typeColumns,
      // Projects hold forms by link until they hold saved permits.
      projectCount: sql<number>`(
        select count(*)::int
        from ${projectItems} as item
        join ${projects} as project on project.id = item.project_id
        where project.user_id = ${savedPermits.userId}
          and item.source_url = ${savedPermits.sourceUrl}
      )`,
      searchSlug: searches.slug,
      permit: searches.permitQuery,
      searchCityName: cities.name,
      region: cities.region,
    })
    .from(savedPermits)
    .leftJoin(blankPdfs, eq(blankPdfs.sourceHash, savedPermits.sourceHash))
    .leftJoin(
      portalPermitTypes,
      eq(portalPermitTypes.id, savedPermits.portalPermitTypeId),
    )
    .leftJoin(searches, eq(searches.id, savedPermits.searchId))
    .leftJoin(cities, eq(cities.id, searches.cityId))
    .where(
      publicId ? ownedBy(userId, publicId) : eq(savedPermits.userId, userId),
    )
    .orderBy(
      asc(savedPermits.cityRegion),
      asc(savedPermits.cityName),
      asc(savedPermits.title),
    )
    .limit(MAX_SAVED_PERMITS)

  return rows.flatMap((row): Array<SavedPermit> => {
    const base = {
      publicId: row.publicId,
      title: row.title,
      city: { name: row.cityName, region: row.cityRegion },
      permitTypes: row.permitTypes,
      sourceUrl: row.sourceUrl,
      notes: row.notes,
      projectCount: row.projectCount,
      search: searchLinkFromColumns({ ...row, cityName: row.searchCityName }),
      savedAt: row.savedAt.toISOString(),
      versionSavedAt: row.versionSavedAt.toISOString(),
    }

    if (row.sourceHash && row.pdf) {
      return [
        {
          ...base,
          kind: 'pdf',
          sourceHash: row.sourceHash,
          pageCount: row.pdf.pageCount,
          fieldCount: row.pdf.fieldCount,
          pdfModifiedAt: row.pdf.pdfModifiedAt?.toISOString() ?? null,
        },
      ]
    }

    const online = row.type && portalPermitTypeFromRow(row.type)

    return online ? [{ ...base, kind: 'online', online }] : []
  })
}

// The projects holding a saved permit's link, for its page.
export async function listPermitProjects(
  db: Database,
  userId: string,
  sourceUrl: string,
) {
  return db
    .selectDistinct({ publicId: projects.publicId, name: projects.name })
    .from(projectItems)
    .innerJoin(projects, eq(projects.id, projectItems.projectId))
    .where(
      and(eq(projects.userId, userId), eq(projectItems.sourceUrl, sourceUrl)),
    )
    .orderBy(asc(projects.name))
}

async function findBySourceUrl(
  db: Database,
  userId: string,
  sourceUrl: string,
) {
  const [row] = await db
    .select({ publicId: savedPermits.publicId })
    .from(savedPermits)
    .where(
      and(
        eq(savedPermits.userId, userId),
        eq(savedPermits.sourceUrl, sourceUrl),
      ),
    )

  return row?.publicId
}

// Downloads the form, stores a blank copy, and adds it to the library. An
// online permit is saved from the catalog instead, with nothing to download.
// Returns the permit's public ID; a link already saved returns the existing
// one without downloading it again.
export async function savePermit(
  db: Database,
  userId: string,
  input: SavePermitInput,
) {
  // An online permit's URL, title and city come from the catalog, never from
  // the browser.
  const online =
    input.portalPermitTypeId === undefined
      ? null
      : await findPortalPermitType(db, input.portalPermitTypeId)

  if (input.portalPermitTypeId !== undefined && !online) {
    throw new UserError('That online permit isn’t available.')
  }

  const sourceUrl = online?.pageUrl ?? input.sourceUrl
  const existing = await findBySourceUrl(db, userId, sourceUrl)

  if (existing) return existing

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(savedPermits)
    .where(eq(savedPermits.userId, userId))

  if (count >= MAX_SAVED_PERMITS) {
    throw new UserError(
      `Your library holds up to ${MAX_SAVED_PERMITS} permits. Remove some to save more.`,
    )
  }

  const sourceHash = online
    ? null
    : await storeBlankPdf(db, await fetchPdfBytes(sourceUrl))

  await db
    .insert(savedPermits)
    .values({
      publicId: newPublicId(),
      userId,
      sourceUrl,
      sourceHash,
      portalPermitTypeId: online?.id ?? null,
      title: online?.name.slice(0, MAX_PERMIT_TITLE_LENGTH) ?? input.title,
      cityName: online?.city.name ?? input.city.name,
      cityRegion: online?.city.region ?? input.city.region,
      permitTypes: sql`coalesce(${searchRunColumn(searches.permitTypes, input.searchSlug)}, '[]'::jsonb)`,
      searchId: searchRunColumn(searches.id, input.searchSlug),
    })
    // Saved meanwhile from another tab: that one stands.
    .onConflictDoNothing()

  const saved = await findBySourceUrl(db, userId, sourceUrl)

  if (!saved) throw new Error('The saved permit was not found after saving.')

  return saved
}

export async function updateSavedPermit(
  db: Database,
  userId: string,
  publicId: string,
  changes: SavedPermitChanges,
) {
  await db
    .update(savedPermits)
    .set({
      title: changes.title,
      notes: changes.notes,
      cityName: changes.city?.name,
      cityRegion: changes.city?.region,
    })
    .where(ownedBy(userId, publicId))
}

// The stored copy stays: other users' libraries, and later project forms,
// may use the same version.
export async function removeSavedPermit(
  db: Database,
  userId: string,
  publicId: string,
) {
  await db.delete(savedPermits).where(ownedBy(userId, publicId))
}
