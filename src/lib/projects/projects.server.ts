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
  // Each project's items come back as a JSON array in the same query. The
  // columns are written out because Drizzle leaves table names off columns in
  // a single-table select, which would make "id" mean the item's own ID here.
  const rows = await db
    .select({
      publicId: projects.publicId,
      name: projects.name,
      cityName: projects.cityName,
      cityRegion: projects.cityRegion,
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
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
    .limit(MAX_PROJECTS)

  return rows.map((row) => ({
    publicId: row.publicId,
    name: row.name,
    city:
      row.cityName && row.cityRegion
        ? { name: row.cityName, region: row.cityRegion }
        : null,
    items: row.items,
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
