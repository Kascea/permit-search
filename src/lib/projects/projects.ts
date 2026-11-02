import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { withUserDatabase } from '#/lib/auth/auth.server'
import type { Database } from '#/lib/db/client.server'
import {
  addProjectItem,
  createProject,
  deleteProject,
  listProjects,
  removeProjectItem,
  renameProject,
} from '#/lib/projects/projects.server'
import {
  validateProjectCity,
  validateProjectItem,
  validateProjectName,
  validatePublicId,
} from '#/lib/projects/types'
import type { Project, ProjectItem } from '#/lib/projects/types'

// Projects belong to the signed-in user; the browser never sends a user ID.
// Each change returns the updated list, so the page needn't ask again.
function changeProjects(
  change: (db: Database, userId: string) => Promise<unknown>,
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

export const createAccountProject = createServerFn({ method: 'POST' })
  .validator(
    (input: { name: string; city: Project['city']; item?: ProjectItem }) => ({
      name: validateProjectName(input.name),
      city: validateProjectCity(input.city),
      item: input.item && validateProjectItem(input.item),
    }),
  )
  .handler(({ data }) =>
    changeProjects((db, userId) => createProject(db, userId, data)),
  )

export const renameAccountProject = createServerFn({ method: 'POST' })
  .validator((input: { publicId: string; name: string }) => ({
    publicId: validatePublicId(input.publicId),
    name: validateProjectName(input.name),
  }))
  .handler(({ data }) =>
    changeProjects((db, userId) =>
      renameProject(db, userId, data.publicId, data.name),
    ),
  )

export const deleteAccountProject = createServerFn({ method: 'POST' })
  .validator((input: { publicId: string }) => ({
    publicId: validatePublicId(input.publicId),
  }))
  .handler(({ data }) =>
    changeProjects((db, userId) => deleteProject(db, userId, data.publicId)),
  )

export const addToAccountProject = createServerFn({ method: 'POST' })
  .validator((input: { publicId: string; item: ProjectItem }) => ({
    publicId: validatePublicId(input.publicId),
    item: validateProjectItem(input.item),
  }))
  .handler(({ data }) =>
    changeProjects((db, userId) =>
      addProjectItem(db, userId, data.publicId, data.item),
    ),
  )

export const removeFromAccountProject = createServerFn({ method: 'POST' })
  .validator((input: { publicId: string; sourceUrl: string }) => ({
    publicId: validatePublicId(input.publicId),
    sourceUrl: validateProjectItem({ sourceUrl: input.sourceUrl }).sourceUrl,
  }))
  .handler(({ data }) =>
    changeProjects((db, userId) =>
      removeProjectItem(db, userId, data.publicId, data.sourceUrl),
    ),
  )
