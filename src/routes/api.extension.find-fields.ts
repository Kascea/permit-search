import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { UserError, parseUserInput } from '#/lib/errors'
import { extensionResponse, signedOut } from '#/lib/extension/api.server'
import {
  findProjectBoxes,
  projectForBoxes,
  webFieldDescription,
} from '#/lib/forms/find-boxes.server'
import { webFieldSchema } from '#/lib/forms/web-fields'
import { publicIdSchema } from '#/lib/projects/types'

const inputSchema = z.object({
  projectId: publicIdSchema(),
  title: z.string().max(500),
  // The page's empty fields that code couldn't fill, read from its HTML.
  fields: z.array(webFieldSchema).max(300),
  optionIds: z.array(z.string().max(500)).max(200),
})

// The browser extension's findPageBoxes: looks among a web form's fields for
// the ones the project values code couldn't place ask for. The same code as
// for PDFs, with each field described from its HTML and no page image. Only
// labels go to Jev, never the project's values. Returns the same matches,
// with each field's id as its boxName.
export const Route = createFileRoute('/api/extension/find-fields')({
  server: {
    handlers: {
      POST: ({ request }) =>
        extensionResponse(request, async () => {
          const body: unknown = await request.json().catch(() => {
            throw new UserError('That request couldn’t be read.')
          })

          // SAFETY: parseUserInput checks the body against the schema.
          const data = parseUserInput(inputSchema)(
            body as z.input<typeof inputSchema>,
          )

          const project = await projectForBoxes(
            request.headers,
            data.projectId,
            signedOut,
          )

          return {
            matches: await findProjectBoxes(project, {
              title: data.title,
              page: null,
              optionIds: data.optionIds,
              boxes: data.fields.map((field) => ({
                name: field.id,
                description: webFieldDescription(field),
              })),
            }),
          }
        }),
    },
  },
})
