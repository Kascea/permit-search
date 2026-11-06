import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { withUserDatabase } from '#/lib/auth/auth.server'
import { hasDatabase } from '#/lib/db/client.server'
import { draftSchema } from '#/lib/drafts/types'
import { UserError, parseUserInput } from '#/lib/errors'
import { checkDraft } from '#/lib/forms/check.server'
import { findBoxesOnPage } from '#/lib/forms/find-boxes.server'
import { loadFormSchema } from '#/lib/forms/ingest.server'
import { fillOptions } from '#/lib/projects/autofill'
import { listProjects } from '#/lib/projects/projects.server'
import { projectSourceUrlSchema, publicIdSchema } from '#/lib/projects/types'
import { limitRequest } from '#/lib/rate-limit.server'
import { createTypeSafeClient } from '#/lib/search/typesafe.server'

// A page image and several questions can take a while.
const FIND_BOXES_TIMEOUT_MS = 60_000

// Base64 of an image well over the size of a rendered page.
const MAX_PAGE_IMAGE_LENGTH = 12_000_000

const formInput = z.object({
  sourceUrl: projectSourceUrlSchema,
  sourceHash: draftSchema.shape.sourceHash,
})

// Reads a form for checking when the editor opens it, so the check button is
// quick. Returns each field's printed label, by field name, for autofill.
export const prepareFormSchema = createServerFn({ method: 'POST' })
  .validator(parseUserInput(formInput))
  .handler(async ({ data }) => {
    await limitRequest('form-schema', new Headers(getRequestHeaders()))

    const schema = await loadFormSchema(data.sourceUrl, data.sourceHash)

    return {
      labels: Object.fromEntries(
        schema.fields.map(({ name, label }) => [name, label]),
      ) satisfies Record<string, string>,
    }
  })

// Autofill's second step: looks on one page for the boxes that the project
// values code couldn't place ask for. The image is of the blank page, rendered by
// the browser. Nothing here is shared between users, so it's fine that the browser
// supplies it. Only labels go to Jev, never the project's values.
export const findPageBoxes = createServerFn({ method: 'POST' })
  .validator(
    parseUserInput(
      formInput.extend({
        projectId: publicIdSchema(),
        pageIndex: z.number().int().min(0),
        pageImage: z.string().min(1).max(MAX_PAGE_IMAGE_LENGTH),
        fieldNames: z.array(z.string().max(500)).max(1000),
        optionIds: z.array(z.string().max(500)).max(200),
      }),
    ),
  )
  .handler(async ({ data }) => {
    const headers = new Headers(getRequestHeaders())
    await limitRequest('form-boxes', headers)

    const { projectId, pageIndex } = data

    const [schema, project] = await Promise.all([
      loadFormSchema(data.sourceUrl, data.sourceHash),
      withUserDatabase(
        headers,
        async (userId, db) =>
          (await listProjects(db, userId, projectId)).at(0) ?? null,
        () => null,
      ),
    ])

    if (!project) throw new UserError('That project couldn’t be found.')

    const page = Uint8Array.from(atob(data.pageImage), (char) =>
      char.charCodeAt(0),
    )

    if (page[0] !== 0xff || page[1] !== 0xd8) {
      throw new UserError('That page image couldn’t be read.')
    }

    const wantedOptions = new Set(data.optionIds)
    const wantedFields = new Set(data.fieldNames)

    return {
      matches: await findBoxesOnPage(
        createTypeSafeClient(FIND_BOXES_TIMEOUT_MS),
        {
          title: schema.title,
          page,
          options: fillOptions(project).filter(({ id }) =>
            wantedOptions.has(id),
          ),
          boxes: schema.fields.filter(
            (field) =>
              wantedFields.has(field.name) &&
              field.kind === 'text' &&
              !field.officeUse &&
              field.rect.pageIndex === pageIndex,
          ),
        },
      ),
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
