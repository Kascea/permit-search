import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import type { Database } from '#/lib/db/client.server'
import { projectItems, projects } from '#/lib/db/schema'
import type { Project, ProjectItem } from '#/lib/projects/types'
import { newPublicId } from '#/lib/saved-searches/search-key'

// Each function takes the request's open connection (see withUserDatabase),
// and each change is a single statement: from a laptop, every extra
// connection or round trip to the database adds noticeable delay.

const MAX_PROJECTS = 200

// Most recently changed first.
export async function listProjects(
  db: Database,
  userId: string,
): Promise<Array<Project>> {
  const rows = await db
    .select({
      id: projects.id,
      publicId: projects.publicId,
      name: projects.name,
      cityName: projects.cityName,
      cityRegion: projects.cityRegion,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
    .limit(MAX_PROJECTS)
  if (rows.length === 0) return []

  const items = await db
    .select({
      projectId: projectItems.projectId,
      sourceUrl: projectItems.sourceUrl,
      title: projectItems.title,
    })
    .from(projectItems)
    .where(
      inArray(
        projectItems.projectId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(desc(projectItems.createdAt))

  return rows.map((row) => ({
    publicId: row.publicId,
    name: row.name,
    city:
      row.cityName && row.cityRegion
        ? { name: row.cityName, region: row.cityRegion }
        : null,
    items: items
      .filter((item) => item.projectId === row.id)
      .map(({ sourceUrl, title }) => ({ sourceUrl, title })),
  }))
}

function ownedBy(userId: string, publicId: string) {
  return and(eq(projects.userId, userId), eq(projects.publicId, publicId))
}

// Creates a project, and adds a first PDF to it when one is given.
export async function createProject(
  db: Database,
  userId: string,
  input: { name: string; city: Project['city']; item?: ProjectItem },
) {
  const values = {
    publicId: newPublicId(),
    userId,
    name: input.name,
    cityName: input.city?.name ?? null,
    cityRegion: input.city?.region ?? null,
  }
  if (!input.item) {
    await db.insert(projects).values(values)
    return
  }

  await db.execute(sql`
    with project as (
      insert into ${projects} (public_id, user_id, name, city_name, city_region)
      values (${values.publicId}, ${userId}, ${values.name},
              ${values.cityName}, ${values.cityRegion})
      returning id
    )
    insert into ${projectItems} (project_id, source_url, title)
    select id, ${input.item.sourceUrl}, ${input.item.title} from project
  `)
}

export async function renameProject(
  db: Database,
  userId: string,
  publicId: string,
  name: string,
) {
  await db.update(projects).set({ name }).where(ownedBy(userId, publicId))
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
