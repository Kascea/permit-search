import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import type { Database } from '#/lib/db/client.server'
import { projectItems, projects } from '#/lib/db/schema'
import type {
  Project,
  ProjectDetails,
  ProjectInput,
  ProjectItem,
} from '#/lib/projects/types'
import { newPublicId } from '#/lib/saved-searches/search-key'

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
} satisfies Record<keyof ProjectDetails, unknown>

type DetailRow = {
  [Key in keyof ProjectDetails]: ProjectDetails[Key] extends string
    ? string | null
    : ProjectDetails[Key]
}

// Null columns read as "", and "" is stored as null.
function detailsFromRow(row: DetailRow): ProjectDetails {
  const details = { ...row } as Record<string, unknown>
  for (const [key, value] of Object.entries(details)) {
    if (value === null && key !== 'estimatedCost') details[key] = ''
  }
  return details as unknown as ProjectDetails
}

function detailsToRow(details: ProjectDetails): DetailRow {
  const row = { ...details } as Record<string, unknown>
  for (const [key, value] of Object.entries(row)) {
    if (value === '') row[key] = null
  }
  return row as DetailRow
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
      items: sql<Array<ProjectItem>>`coalesce((
        select json_agg(
          json_build_object('sourceUrl', item.source_url, 'title', item.title)
          order by item.created_at desc
        )
        from ${projectItems} as item
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
    items: row.items,
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
  input: ProjectInput & { item?: ProjectItem },
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
    with project as (${insert.returning({ id: projects.id })})
    insert into ${projectItems} (project_id, source_url, title)
    select id, ${input.item.sourceUrl}, ${input.item.title} from project
  `)
  return publicId
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

// Its items go with it.
export async function deleteProject(
  db: Database,
  userId: string,
  publicId: string,
) {
  await db.delete(projects).where(ownedBy(userId, publicId))
}

// Moves the project to the top of the list and adds the PDF, unless it's
// already there. Does nothing when the project isn't the user's.
export async function addProjectItem(
  db: Database,
  userId: string,
  publicId: string,
  item: ProjectItem,
) {
  await db.execute(sql`
    with project as (
      update ${projects} set updated_at = now()
      where ${ownedBy(userId, publicId)}
      returning id
    )
    insert into ${projectItems} (project_id, source_url, title)
    select id, ${item.sourceUrl}, ${item.title} from project
    on conflict do nothing
  `)
}

export async function removeProjectItem(
  db: Database,
  userId: string,
  publicId: string,
  sourceUrl: string,
) {
  await db
    .delete(projectItems)
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
