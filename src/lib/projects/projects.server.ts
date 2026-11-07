import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import type { Database } from '#/lib/db/client.server'
import {
  cities,
  pdfDrafts,
  portalPermitTypes,
  projectItems,
  projects,
  searches,
  trackedPermits,
} from '#/lib/db/schema'
import { UserError } from '#/lib/errors'
import { searchLinkFromColumns } from '#/lib/navigation/origin'
import { searchRunColumn } from '#/lib/saved-searches/search-run.server'
import {
  EMPTY_PROJECT_DETAILS,
  PROJECT_TEXT_FIELDS,
} from '#/lib/projects/types'
import type {
  Project,
  ProjectDetails,
  ProjectInput,
  ProjectItem,
} from '#/lib/projects/types'
import { newPublicId } from '#/lib/saved-searches/search-key'
import {
  PERMIT_PROVIDERS,
  findJurisdiction,
  isPermitProviderId,
} from '#/lib/portals/providers'
import { findPortalPermitType } from '#/lib/portals/catalog.server'
import type {
  PermitRequirements,
  PermitStatus,
  PortalPermitType,
  TrackedPermit,
} from '#/lib/portals/types'

// Each function takes the request's open connection (see withUserDatabase),
// and each change is a single statement: from a laptop, every extra
// connection or round trip to the database adds noticeable delay.

const MAX_PROJECTS = 200

// The columns behind ProjectDetails, under the same names.
const detailColumns = {
  streetAddress: projects.streetAddress,
  unit: projects.unit,
  zipCode: projects.zipCode,
  parcelNumber: projects.parcelNumber,
  workDescription: projects.workDescription,
  estimatedCost: projects.estimatedCost,
  ownerName: projects.ownerName,
  ownerPhone: projects.ownerPhone,
  ownerEmail: projects.ownerEmail,
  ownerMailingAddress: projects.ownerMailingAddress,
  applicantIsOwner: projects.applicantIsOwner,
  applicantName: projects.applicantName,
  applicantPhone: projects.applicantPhone,
  applicantEmail: projects.applicantEmail,
  contractorCompany: projects.contractorCompany,
  contractorLicense: projects.contractorLicense,
  contractorPhone: projects.contractorPhone,
  contractorEmail: projects.contractorEmail,
} satisfies Record<keyof ProjectDetails, AnyPgColumn>

type DetailRow = {
  [Key in keyof ProjectDetails]: ProjectDetails[Key] extends string
    ? string | null
    : ProjectDetails[Key]
}

// Null columns read as "", and "" is stored as null.
function detailsFromRow(row: DetailRow): ProjectDetails {
  const details: ProjectDetails = {
    ...EMPTY_PROJECT_DETAILS,
    estimatedCost: row.estimatedCost,
    applicantIsOwner: row.applicantIsOwner,
  }

  for (const { key } of PROJECT_TEXT_FIELDS) details[key] = row[key] ?? ''

  return details
}

function detailsToRow(details: ProjectDetails): DetailRow {
  const row: DetailRow = { ...details }

  for (const { key } of PROJECT_TEXT_FIELDS) row[key] = details[key] || null

  return row
}

function inputToRow(input: ProjectInput) {
  return {
    name: input.name,
    cityName: input.city?.name ?? null,
    cityRegion: input.city?.region ?? null,
    ...detailsToRow(input.details),
    extraFields: input.extraFields,
  }
}

// An item as listProjects' JSON returns it; the search columns are null when
// it wasn't added from a search, the type* ones for PDFs, and the tracked*
// ones when no permit number was added.
interface ItemRow {
  kind: 'pdf' | 'online'
  sourceUrl: string
  title: string
  filedAt: string | null
  typeId: number | null
  typeProvider: string | null
  typeJurisdiction: string | null
  typeName: string | null
  typeCategory: string | null
  typePlansRequired: boolean | null
  typePageUrl: string | null
  typeApplyUrl: string | null
  typeRequirements: PermitRequirements | null
  searchSlug: string | null
  permit: string | null
  cityName: string | null
  region: string | null
  trackedProvider: string | null
  trackedJurisdiction: string | null
  trackedNumber: string | null
  trackedStatus: PermitStatus | null
  trackedCheckedAt: string | null
  trackedCheckError: string | null
}

function itemFromRow(row: ItemRow): ProjectItem {
  return {
    kind: row.kind,
    sourceUrl: row.sourceUrl,
    title: row.title,
    filedAt: row.filedAt ?? undefined,
    search: searchLinkFromColumns(row),
    permit: trackedPermitFromRow(row),
    online: portalTypeFromRow(row),
  }
}

// An online application's permit type; undefined for PDFs, or when its
// provider or city is no longer supported.
function portalTypeFromRow(row: ItemRow): PortalPermitType | undefined {
  const { typeId, typeProvider: provider, typeJurisdiction: code } = row

  if (
    row.kind !== 'online' ||
    typeId === null ||
    !provider ||
    !code ||
    !isPermitProviderId(provider)
  ) {
    return undefined
  }

  const jurisdiction = findJurisdiction(provider, code)

  if (!jurisdiction) return undefined

  return {
    id: typeId,
    provider,
    providerName: PERMIT_PROVIDERS[provider].name,
    jurisdiction: code,
    city: jurisdiction.city,
    name: row.typeName ?? row.title,
    category: row.typeCategory,
    plansRequired: row.typePlansRequired,
    pageUrl: row.typePageUrl ?? row.sourceUrl,
    applyUrl: row.typeApplyUrl,
    requirements: row.typeRequirements,
  }
}

// What's inserted for an item. An online application's URL and title come
// from the catalog, never from the browser.
interface ItemToInsert {
  kind: 'pdf' | 'online'
  sourceUrl: string
  title: string
  searchSlug?: string
  portalPermitTypeId: number | null
}

export async function resolveProjectItem(
  db: Database,
  item: ProjectItem,
): Promise<ItemToInsert> {
  if (item.portalPermitTypeId === undefined) {
    return { ...item, kind: 'pdf', portalPermitTypeId: null }
  }

  const type = await findPortalPermitType(db, item.portalPermitTypeId)

  if (!type) throw new UserError('That online permit isn’t available.')

  return {
    kind: 'online',
    sourceUrl: type.pageUrl,
    title: type.name,
    searchSlug: item.searchSlug,
    portalPermitTypeId: type.id,
  }
}

// Undefined when there's no permit, or its provider or city is no longer
// supported.
function trackedPermitFromRow(row: ItemRow): TrackedPermit | undefined {
  const { trackedProvider: provider, trackedJurisdiction: code } = row

  if (
    !provider ||
    !code ||
    !row.trackedNumber ||
    !isPermitProviderId(provider)
  ) {
    return undefined
  }

  const jurisdiction = findJurisdiction(provider, code)

  if (!jurisdiction) return undefined

  return {
    provider,
    jurisdiction: code,
    permitNumber: row.trackedNumber,
    status: row.trackedStatus,
    checkedAt: row.trackedCheckedAt,
    checkError: row.trackedCheckError,
    permitUrl:
      row.trackedStatus?.permitUrl ??
      PERMIT_PROVIDERS[provider].permitUrl(jurisdiction, row.trackedNumber),
  }
}

// Most recently changed first. With a public ID, just that project (if it's
// the user's).
export async function listProjects(
  db: Database,
  userId: string,
  publicId?: string,
): Promise<Array<Project>> {
  // Each project's items come back as a JSON array in the same query. The
  // columns are written out because Drizzle leaves table names off columns in
  // a single-table select, which would make "id" mean the item's own ID here.
  const rows = await db
    .select({
      publicId: projects.publicId,
      name: projects.name,
      cityName: projects.cityName,
      cityRegion: projects.cityRegion,
      details: detailColumns,
      extraFields: projects.extraFields,
      updatedAt: projects.updatedAt,
      items: sql<Array<ItemRow>>`coalesce((
        select json_agg(
          json_build_object(
            'kind', item.kind,
            'sourceUrl', item.source_url,
            'title', item.title,
            'filedAt', item.filed_at,
            'searchSlug', search.slug,
            'permit', search.permit_query,
            'cityName', city.name,
            'region', city.region,
            'trackedProvider', tracked.provider,
            'trackedJurisdiction', tracked.jurisdiction,
            'trackedNumber', tracked.permit_number,
            'trackedStatus', tracked.status,
            'trackedCheckedAt', tracked.checked_at,
            'trackedCheckError', tracked.check_error,
            'typeId', type.id,
            'typeProvider', type.provider,
            'typeJurisdiction', type.jurisdiction,
            'typeName', type.name,
            'typeCategory', type.category,
            'typePlansRequired', type.plans_required,
            'typePageUrl', type.page_url,
            'typeApplyUrl', type.apply_url,
            'typeRequirements', type.requirements
          )
          order by item.created_at desc
        )
        from ${projectItems} as item
        left join ${searches} as search on search.id = item.search_id
        left join ${cities} as city on city.id = search.city_id
        left join ${trackedPermits} as tracked
          on tracked.project_item_id = item.id
        left join ${portalPermitTypes} as type
          on type.id = item.portal_permit_type_id
        where item.project_id = ${projects}.id
      ), '[]'::json)`,
    })
    .from(projects)
    .where(publicId ? ownedBy(userId, publicId) : eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
    .limit(MAX_PROJECTS)

  return rows.map((row) => ({
    publicId: row.publicId,
    name: row.name,
    city:
      row.cityName && row.cityRegion
        ? { name: row.cityName, region: row.cityRegion }
        : null,
    details: detailsFromRow(row.details),
    extraFields: row.extraFields,
    items: row.items.map(itemFromRow),
    updatedAt: row.updatedAt.toISOString(),
  }))
}

function ownedBy(userId: string, publicId: string) {
  return and(eq(projects.userId, userId), eq(projects.publicId, publicId))
}

// Creates a project, and adds a first PDF to it when one is given. Returns
// the new project's public ID.
export async function createProject(
  db: Database,
  userId: string,
  input: ProjectInput & { item?: ItemToInsert },
) {
  const publicId = newPublicId()

  const insert = db
    .insert(projects)
    .values({ publicId, userId, ...inputToRow(input) })

  if (!input.item) {
    await insert

    return publicId
  }

  await db.execute(sql`
    with project as (${insert.returning({ id: projects.id }).getSQL()}),
    item as (
      insert into ${projectItems}
        (project_id, kind, source_url, title, search_id, portal_permit_type_id)
      select id, ${input.item.kind}, ${input.item.sourceUrl}, ${input.item.title},
        ${searchRunColumn(searches.id, input.item.searchSlug)}, ${input.item.portalPermitTypeId}
      from project
      returning id
    )
    ${adoptLooseDraft(userId, input.item.sourceUrl)}
  `)

  return publicId
}

// Moves the user's draft of a form outside any project to the form just added
// (the "item" row of the statement this ends), so "Add to project" brings their
// answers along. There's only one such draft, so at most one project gets it,
// and the next project starts blank.
function adoptLooseDraft(userId: string, sourceUrl: string) {
  return sql`
    update ${pdfDrafts} set project_item_id = item.id
    from item
    where ${pdfDrafts.userId} = ${userId}
      and ${pdfDrafts.sourceUrl} = ${sourceUrl}
      and ${pdfDrafts.projectItemId} is null
  `
}

// Clears the way for the given items to be deleted. Their drafts stay, moving
// outside a project, but a user has only one draft of a URL there. So when one
// is already there, the older of the two goes. Runs inside the statement that
// deletes the items: database rules that move the drafts run when it ends.
function dropOlderDrafts(items: SQL) {
  return sql`
    dropped as (
      delete from ${pdfDrafts}
      where ${pdfDrafts.id} in (
        select case
          when attached.updated_at > loose.updated_at then loose.id
          else attached.id
        end
        from ${pdfDrafts} as attached
        join ${pdfDrafts} as loose
          on loose.user_id = attached.user_id
          and loose.source_url = attached.source_url
          and loose.project_item_id is null
        where attached.project_item_id in (${items})
      )
    )
  `
}

// Replaces the project's name, city, details and extra fields.
export async function updateProject(
  db: Database,
  userId: string,
  publicId: string,
  input: ProjectInput,
) {
  await db
    .update(projects)
    .set(inputToRow(input))
    .where(ownedBy(userId, publicId))
}

// Its items go with it; their drafts stay, outside a project.
export async function deleteProject(
  db: Database,
  userId: string,
  publicId: string,
) {
  await db.execute(sql`
    with ${dropOlderDrafts(sql`
      select item.id from ${projectItems} as item
      join ${projects} on ${projects.id} = item.project_id
      where ${ownedBy(userId, publicId)}
    `)}
    delete from ${projects} where ${ownedBy(userId, publicId)}
  `)
}

// Moves the project to the top of the list and adds the item, unless it's
// already there. Does nothing when the project isn't the user's.
export async function addProjectItem(
  db: Database,
  userId: string,
  publicId: string,
  item: ItemToInsert,
) {
  await db.execute(sql`
    with project as (
      update ${projects} set updated_at = now()
      where ${ownedBy(userId, publicId)}
      returning id
    ),
    item as (
      insert into ${projectItems}
        (project_id, kind, source_url, title, search_id, portal_permit_type_id)
      select id, ${item.kind}, ${item.sourceUrl}, ${item.title},
        ${searchRunColumn(searches.id, item.searchSlug)}, ${item.portalPermitTypeId}
      from project
      on conflict do nothing
      returning id
    )
    ${adoptLooseDraft(userId, item.sourceUrl)}
  `)
}

// Its draft stays, outside a project.
export async function removeProjectItem(
  db: Database,
  userId: string,
  publicId: string,
  sourceUrl: string,
) {
  const item = sql`
    select ${projectItems.id} from ${projectItems}
    join ${projects} on ${projects.id} = ${projectItems.projectId}
    where ${projectItems.sourceUrl} = ${sourceUrl}
      and ${ownedBy(userId, publicId)}
  `

  await db.execute(sql`
    with ${dropOlderDrafts(item)}
    delete from ${projectItems} where ${projectItems.id} in (${item})
  `)
}

// Marks a form as filed with the city, or not.
export async function setProjectItemFiled(
  db: Database,
  userId: string,
  publicId: string,
  sourceUrl: string,
  filed: boolean,
) {
  await db
    .update(projectItems)
    .set({ filedAt: filed ? new Date() : null })
    .where(
      and(
        eq(projectItems.sourceUrl, sourceUrl),
        inArray(
          projectItems.projectId,
          db
            .select({ id: projects.id })
            .from(projects)
            .where(ownedBy(userId, publicId)),
        ),
      ),
    )
}
