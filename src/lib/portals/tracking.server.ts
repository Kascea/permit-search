import { and, eq, inArray, sql } from 'drizzle-orm'

import type { Database } from '#/lib/db/client.server'
import { projectItems, projects, trackedPermits } from '#/lib/db/schema'
import { UserError } from '#/lib/errors'
import { isPermitCheckError } from '#/lib/portals/fetcher.server'
import { findJurisdiction, isPermitProviderId } from '#/lib/portals/providers'
import type { TrackedPermitInput } from '#/lib/portals/providers'
import { STATUS_FETCHERS } from '#/lib/portals/providers.server'
import type { PermitCheckResult, PermitStatus } from '#/lib/portals/types'

// Like projects.server.ts: each takes the request's open connection, and each
// change is a single statement, except the status check.

// The project_items row for a form in one of the user's projects. Forms
// outside a project have no row, so they can't be tracked.
function ownedItemIds(
  db: Database,
  userId: string,
  publicId: string,
  sourceUrl: string,
) {
  return db
    .select({ id: projectItems.id })
    .from(projectItems)
    .innerJoin(projects, eq(projects.id, projectItems.projectId))
    .where(
      and(
        eq(projects.userId, userId),
        eq(projects.publicId, publicId),
        eq(projectItems.sourceUrl, sourceUrl),
      ),
    )
}

// Adds or replaces the form's permit. A different number clears the status
// read for the old one.
export async function setItemPermit(
  db: Database,
  userId: string,
  publicId: string,
  sourceUrl: string,
  permit: TrackedPermitInput,
) {
  const result = await db.execute(sql`
    insert into ${trackedPermits}
      (project_item_id, provider, jurisdiction, permit_number)
    select id, ${permit.provider}, ${permit.jurisdiction}, ${permit.permitNumber}
    from (${ownedItemIds(db, userId, publicId, sourceUrl)}) as item
    on conflict (project_item_id) do update set
      provider = excluded.provider,
      jurisdiction = excluded.jurisdiction,
      permit_number = excluded.permit_number,
      status = null,
      checked_at = null,
      status_changed_at = null,
      check_error = null,
      updated_at = now()
    where (${trackedPermits}.provider, ${trackedPermits}.jurisdiction,
        ${trackedPermits}.permit_number)
      is distinct from
      (excluded.provider, excluded.jurisdiction, excluded.permit_number)
  `)

  // No row: the form isn't in this project. An unchanged number is no row
  // too, so look before saying so.
  if (result.rowCount === 0) {
    const [item] = await ownedItemIds(db, userId, publicId, sourceUrl)

    if (!item) throw new UserError('That form isn’t in this project.')
  }
}

// A check within this long of the last good one reuses its status, so
// repeated clicks don't each reach the city's portal.
const RECHECK_AFTER_MS = 15 * 60 * 1_000

// Reads the permit's status from its portal and stores it. A failed check
// keeps the last good status and stores why it failed, written for the user.
// Reads, fetches, then writes: the fetch can't share a statement. Returns
// what happened, so the page can say so even when nothing changed.
export async function checkItemPermit(
  db: Database,
  userId: string,
  publicId: string,
  sourceUrl: string,
): Promise<PermitCheckResult> {
  const [permit] = await db
    .select({
      id: trackedPermits.id,
      provider: trackedPermits.provider,
      jurisdiction: trackedPermits.jurisdiction,
      permitNumber: trackedPermits.permitNumber,
      status: trackedPermits.status,
      checkedAt: trackedPermits.checkedAt,
    })
    .from(trackedPermits)
    .where(
      inArray(
        trackedPermits.projectItemId,
        ownedItemIds(db, userId, publicId, sourceUrl),
      ),
    )

  if (!permit) throw new UserError('Add a permit number to this form first.')

  if (
    permit.checkedAt &&
    Date.now() - permit.checkedAt.getTime() < RECHECK_AFTER_MS
  ) {
    return { kind: 'recent', status: permit.status }
  }

  const jurisdiction = isPermitProviderId(permit.provider)
    ? findJurisdiction(permit.provider, permit.jurisdiction)
    : undefined

  if (!isPermitProviderId(permit.provider) || !jurisdiction) {
    throw new UserError('Permit tracking isn’t available for that city.')
  }

  // Only the fetch is caught: a failed database write is a bug, not the
  // portal's fault, and goes to the server function's error logging.
  let status: PermitStatus

  try {
    status = await STATUS_FETCHERS[permit.provider].fetchStatus(
      jurisdiction,
      permit.permitNumber,
    )
  } catch (cause) {
    const checkError = isPermitCheckError(cause) ? cause : null

    // The permit number stays out of logs; the city is enough to find a
    // page the parser no longer reads.
    if (!checkError || checkError.portalChanged) {
      console.error(
        JSON.stringify({
          message: 'permit status check failed',
          provider: permit.provider,
          jurisdiction: permit.jurisdiction,
          error: cause instanceof Error ? cause.message : String(cause),
          errorName: cause instanceof Error ? cause.name : undefined,
          cause:
            cause instanceof Error && cause.cause instanceof Error
              ? cause.cause.message
              : undefined,
        }),
      )
    }

    const message =
      checkError?.message ??
      'Couldn’t reach the city’s portal. Try again later.'

    await db
      .update(trackedPermits)
      .set({ checkError: message })
      .where(eq(trackedPermits.id, permit.id))

    return { kind: 'failed', message }
  }

  const changed = JSON.stringify(status) !== JSON.stringify(permit.status)

  await db
    .update(trackedPermits)
    .set({
      status,
      checkedAt: new Date(),
      checkError: null,
      ...(changed && { statusChangedAt: new Date() }),
    })
    .where(eq(trackedPermits.id, permit.id))

  // A new date or fee alone isn't news; a new status label is.
  return status.label === permit.status?.label
    ? { kind: 'unchanged', status }
    : { kind: 'changed', status }
}

export async function removeItemPermit(
  db: Database,
  userId: string,
  publicId: string,
  sourceUrl: string,
) {
  await db
    .delete(trackedPermits)
    .where(
      inArray(
        trackedPermits.projectItemId,
        ownedItemIds(db, userId, publicId, sourceUrl),
      ),
    )
}
