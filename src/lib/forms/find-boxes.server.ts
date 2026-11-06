import { image } from '@typesafe-ai/sdk'
import type { TypeSafeClient } from '@typesafe-ai/sdk'

import { UserError } from '#/lib/errors'
import { YES_THRESHOLD } from '#/lib/forms/checks'
import { pageHasBoxQuestion, whichBoxQuestion } from '#/lib/forms/questions'

// Project fields per Jev request, leaving room for the page image.
const OPTIONS_PER_REQUEST = 8

// Sent with every request that holds an image.
const IMAGE_HEADERS = { 'TypeSafe-Danger-Zone-Images': 'true' }

interface FindBoxesInput {
  title: string
  // The page as a JPEG.
  page: Uint8Array
  options: Array<{ id: string; label: string }>
  // The page's empty boxes.
  boxes: Array<{ name: string; line: string }>
}

// Looks on one page for the box each project value belongs in. Jev picks the
// closest box and says whether the page has one at all; code then decides. Two
// values wanting one box fill neither. Only labels are sent, never values.
export async function findBoxesOnPage(
  client: TypeSafeClient,
  { title, page, options, boxes }: FindBoxesInput,
) {
  if (options.length === 0 || boxes.length === 0) return []

  const boxOptions = Object.fromEntries(
    boxes.map(({ name, line }) => [
      name,
      `PDF name ${name}; printed nearby: ${line}`,
    ]),
  )

  const [onlyBox] = boxes
  const state = { form: { title }, page: image(page) }
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
            { headers: IMAGE_HEADERS },
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
