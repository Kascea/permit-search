import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { withUserDatabase } from '#/lib/auth/auth.server'
import type { Database } from '#/lib/db/client.server'
import { parseUserInput } from '#/lib/errors'
import {
  addProjectItem,
  createProject,
  deleteProject,
  listProjects,
  removeProjectItem,
  updateProject,
} from '#/lib/projects/projects.server'
import {
  projectInputSchema,
  projectItemSchema,
  projectSourceUrlSchema,
  publicIdSchema,
} from '#/lib/projects/types'
import type { Project } from '#/lib/projects/types'

// Projects belong to the signed-in user; the browser never sends a user ID.
// Each change returns the updated list, so the page needn't ask again.
function changeProjects(
  change: (db: Database, userId: string) => Promise<void>,
): Promise<Array<Project>> {
  return withUserDatabase(
    new Headers(getRequestHeaders()),
    async (userId, db) => {
      await change(db, userId)

      return listProjects(db, userId)
    },
  )
}

// Null when signed out, so pages can ask the visitor to sign in.
export const listAccountProjects = createServerFn({ method: 'GET' }).handler(
  () =>
    withUserDatabase(
      new Headers(getRequestHeaders()),
      (userId, db) => listProjects(db, userId),
      () => null,
    ),
)

// Null when signed out; the project is null when it isn't the user's.
export const getAccountProject = createServerFn({ method: 'GET' })
  .validator(parseUserInput(z.object({ publicId: publicIdSchema() })))
  .handler(({ data }) =>
    withUserDatabase(
      new Headers(getRequestHeaders()),
      async (userId, db) => ({
        project: (await listProjects(db, userId, data.publicId)).at(0) ?? null,
      }),
      () => null,
    ),
  )

// Returns the new project's ID along with the list.
export const createAccountProject = createServerFn({ method: 'POST' })
  .validator(
    parseUserInput(
      projectInputSchema.extend({ item: projectItemSchema.optional() }),
    ),
  )
  .handler(async ({ data }) => {
    let publicId = ''

    const projects = await changeProjects(async (db, userId) => {
      publicId = await createProject(db, userId, data)
    })

    return { publicId, projects }
  })

export const updateAccountProject = createServerFn({ method: 'POST' })
  .validator(
    parseUserInput(projectInputSchema.extend({ publicId: publicIdSchema() })),
  )
  .handler(({ data }) =>
    changeProjects((db, userId) =>
      updateProject(db, userId, data.publicId, data),
    ),
  )

export const deleteAccountProject = createServerFn({ method: 'POST' })
  .validator(parseUserInput(z.object({ publicId: publicIdSchema() })))
  .handler(({ data }) =>
    changeProjects((db, userId) => deleteProject(db, userId, data.publicId)),
  )

export const addToAccountProject = createServerFn({ method: 'POST' })
  .validator(
    parseUserInput(
      z.object({ publicId: publicIdSchema(), item: projectItemSchema }),
    ),
  )
  .handler(({ data }) =>
    changeProjects((db, userId) =>
      addProjectItem(db, userId, data.publicId, data.item),
    ),
  )

export const removeFromAccountProject = createServerFn({ method: 'POST' })
  .validator(
    parseUserInput(
      z.object({
        publicId: publicIdSchema(),
        sourceUrl: projectSourceUrlSchema,
      }),
    ),
  )
  .handler(({ data }) =>
    changeProjects((db, userId) =>
      removeProjectItem(db, userId, data.publicId, data.sourceUrl),
    ),
  )
