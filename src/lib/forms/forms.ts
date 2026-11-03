import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { withUserDatabase } from '#/lib/auth/auth.server'
import { hasDatabase } from '#/lib/db/client.server'
import { draftSchema } from '#/lib/drafts/types'
import { parseUserInput } from '#/lib/errors'
import { checkDraft } from '#/lib/forms/check.server'
import { loadFormSchema } from '#/lib/forms/ingest.server'
import type { FieldRole } from '#/lib/forms/roles'
import { listProjects } from '#/lib/projects/projects.server'
import { projectSourceUrlSchema, publicIdSchema } from '#/lib/projects/types'
import { limitRequest } from '#/lib/rate-limit.server'

const formInput = z.object({
  sourceUrl: projectSourceUrlSchema,
  sourceHash: draftSchema.shape.sourceHash,
})

// Reads a form for checking when the editor opens it, so the check button is
// quick. Returns each field's role, by field name.
export const prepareFormSchema = createServerFn({ method: 'POST' })
  .validator(parseUserInput(formInput))
  .handler(async ({ data }) => {
    await limitRequest('form-schema', new Headers(getRequestHeaders()))

    const schema = await loadFormSchema(data.sourceUrl, data.sourceHash)

    return {
      roles: Object.fromEntries(
        schema.fields.flatMap(({ name, role }) => (role ? [[name, role]] : [])),
      ) satisfies Record<string, FieldRole>,
    }
  })

// Checks a draft for mistakes. The project, when given, must be the signed-in
// user's; it's what the draft's values are compared with.
export const checkFormDraft = createServerFn({ method: 'POST' })
  .validator(
    parseUserInput(
      formInput.extend({
        content: draftSchema.shape.content,
        projectId: publicIdSchema().optional(),
      }),
    ),
  )
  .handler(async ({ data }) => {
    const headers = new Headers(getRequestHeaders())
    await limitRequest('form-check', headers)

    const { projectId } = data

    const [schema, project] = await Promise.all([
      loadFormSchema(data.sourceUrl, data.sourceHash),
      projectId && hasDatabase()
        ? withUserDatabase(
            headers,
            async (userId, db) =>
              (await listProjects(db, userId, projectId)).at(0) ?? null,
            () => null,
          )
        : null,
    ])

    return checkDraft(schema, data.content, project)
  })
