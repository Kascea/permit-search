import { image } from '@typesafe-ai/sdk'
import type { TypeSafeClient } from '@typesafe-ai/sdk'

import { withUserDatabase } from '#/lib/auth/auth.server'
import { UserError } from '#/lib/errors'
import { YES_THRESHOLD } from '#/lib/forms/checks'
import { pageHasBoxQuestion, whichBoxQuestion } from '#/lib/forms/questions'
import type { WebFieldInput } from '#/lib/forms/web-fields'
import { fillOptions } from '#/lib/projects/autofill'
import { listProjects } from '#/lib/projects/projects.server'
import type { Project } from '#/lib/projects/types'
import { limitRequest } from '#/lib/rate-limit.server'
import { createTypeSafeClient } from '#/lib/search/typesafe.server'

// A page and several questions can take a while.
const FIND_BOXES_TIMEOUT_MS = 60_000

// Project fields per Jev request, leaving room for the page image.
const OPTIONS_PER_REQUEST = 8

// Sent with every request that holds an image.
const IMAGE_HEADERS = { 'TypeSafe-Danger-Zone-Images': 'true' }

interface FindBoxesInput {
  title: string
  // A PDF page as a JPEG. Web forms send none: Jev goes by the boxes'
  // descriptions alone.
  page: Uint8Array | null
  options: Array<{ id: string; label: string }>
  // The page's empty boxes, each with what Jev is told about it, such as its
  // PDF name and the text printed nearby.
  boxes: Array<{ name: string; description: string }>
}

// Looks on one page for the box each project value belongs in. Jev picks the
// closest box and says whether the page has one at all; code then decides. Two
// values wanting one box fill neither. Only labels are sent, never values.
// Used for PDF forms and, from the browser extension, for web forms.
export async function findBoxesOnPage(
  client: TypeSafeClient,
  { title, page, options, boxes }: FindBoxesInput,
) {
  if (options.length === 0 || boxes.length === 0) return []

  const boxOptions = Object.fromEntries(
    boxes.map(({ name, description }) => [name, description]),
  )

  const [onlyBox] = boxes

  // Without an image, the page is its boxes' descriptions, as the Noul
  // doesn't see the Choice's options. A web form's labels are text.
  const state = {
    form: { title },
    page: page ? image(page) : boxes.map(({ description }) => description),
  }

  const batches: Array<typeof options> = []

  for (let start = 0; start < options.length; start += OPTIONS_PER_REQUEST) {
    batches.push(options.slice(start, start + OPTIONS_PER_REQUEST))
  }

  try {
    const answers = (
      await Promise.all(
        batches.map(async (batch) => {
          const result = await client.systemOne(
            {
              state,
              questions: Object.fromEntries(
                batch.flatMap(({ label }, index) => [
                  [`has${index}`, pageHasBoxQuestion(label)],
                  // A Choice needs more than one option.
                  ...(boxes.length > 1
                    ? [
                        [
                          `box${index}`,
                          whichBoxQuestion(label, boxOptions),
                        ] as const,
                      ]
                    : []),
                ]),
              ),
            },
            page ? { headers: IMAGE_HEADERS } : {},
          )

          return batch.map((option, index) => {
            const has = result.answers[`has${index}`]
            const box = result.answers[`box${index}`]

            return {
              option,
              box: box?.type === 'choice' ? box.choice : onlyBox.name,
              pick:
                box?.type === 'choice'
                  ? (box.probabilities[box.choice] ?? 0)
                  : 1,
              onPage: has?.type === 'noul' ? has.noul : 0,
            }
          })
        }),
      )
    ).flat()

    const found = answers.filter(({ onPage }) => onPage >= YES_THRESHOLD)
    const wantsPerBox = new Map<string, number>()

    for (const { box } of found) {
      wantsPerBox.set(box, (wantsPerBox.get(box) ?? 0) + 1)
    }

    const isFilled = (box: string, onPage: number) =>
      onPage >= YES_THRESHOLD && wantsPerBox.get(box) === 1

    // Field names and labels only, never the project's values.
    for (const { option, box, pick, onPage } of answers) {
      console.log(
        JSON.stringify({
          message: 'autofill value',
          value: option.label,
          box,
          pick,
          onPage,
          needed: YES_THRESHOLD,
          result: isFilled(box, onPage)
            ? 'filled'
            : onPage >= YES_THRESHOLD
              ? 'box wanted twice'
              : 'not on this page',
        }),
      )
    }

    return found.flatMap(({ option, box, onPage }) =>
      isFilled(box, onPage) ? [{ boxName: box, optionId: option.id }] : [],
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'autofill page failed',
        title,
        boxes: boxes.length,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    throw new UserError('Autofill couldn’t reach its matching service.')
  }
}

// What Jev is told about a PDF box: its PDF name and the text printed nearby.
export function pdfBoxDescription(name: string, line: string) {
  return `PDF name ${name}; printed nearby: ${line}`
}

// What Jev is told about a web form field, from its HTML. Never its value.
export function webFieldDescription(field: WebFieldInput) {
  return [
    field.kind === 'select' ? 'Dropdown' : 'Text field',
    field.name && `HTML name ${field.name}`,
    field.label && `label: ${field.label}`,
    field.section && `section: ${field.section}`,
    field.nearby && field.nearby !== field.label && `nearby: ${field.nearby}`,
  ]
    .filter(Boolean)
    .join('; ')
}

// The start of every box search, from the editor or the extension: the rate
// limit, then the signed-in user's project, before anything costs money.
// Signed out, it calls signedOut when given, and throws otherwise.
export async function projectForBoxes(
  headers: Headers,
  projectId: string,
  signedOut?: () => never,
) {
  await limitRequest('form-boxes', headers)

  const project = await withUserDatabase(
    headers,
    async (userId, db) =>
      (await listProjects(db, userId, projectId)).at(0) ?? null,
    signedOut,
  )

  if (!project) throw new UserError('That project couldn’t be found.')

  return project
}

// Looks for the boxes of the project values named by optionIds: a PDF page
// for the editor, or a web form's fields for the extension.
export function findProjectBoxes(
  project: Project,
  {
    optionIds,
    ...input
  }: Omit<FindBoxesInput, 'options'> & { optionIds: Array<string> },
) {
  const wanted = new Set(optionIds)

  return findBoxesOnPage(createTypeSafeClient(FIND_BOXES_TIMEOUT_MS), {
    ...input,
    options: fillOptions(project).filter(({ id }) => wanted.has(id)),
  })
}
