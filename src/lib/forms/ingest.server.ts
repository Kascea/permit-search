import type {
  ChoiceResponse,
  NoulResponse,
  ScoreResponse,
} from '@typesafe-ai/sdk'
import { eq } from 'drizzle-orm'

import { hasDatabase, withDatabase } from '#/lib/db/client.server'
import { formSchemas } from '#/lib/db/schema'
import { draftTitle } from '#/lib/drafts/types'
import { UserError } from '#/lib/errors'
import { checksFor, YES_THRESHOLD } from '#/lib/forms/checks'
import { extractForm } from '#/lib/forms/extract.server'
import type { ExtractedField } from '#/lib/forms/extract.server'
import {
  checkboxQuestions,
  choiceFieldQuestions,
  headingRequiredQuestion,
  readRole,
  textFieldQuestions,
} from '#/lib/forms/questions'
import type { FormQuestion } from '#/lib/forms/questions'
import { FORM_SCHEMA_VERSION } from '#/lib/forms/types'
import type { FormFieldSchema, FormSchema } from '#/lib/forms/types'
import { sha256Hex } from '#/lib/pdf/blank-pdf.server'
import { fetchPdfBytes } from '#/lib/pdf/fetch-pdf.server'
import { createTypeSafeClient } from '#/lib/search/typesafe.server'

type FormAnswer = NoulResponse | ChoiceResponse | ScoreResponse

// Fields per Jev request: up to three questions each, well under the
// context limit.
const FIELDS_PER_REQUEST = 30

// The stored schema for this version of the form, or a new one. The PDF is
// downloaded again here rather than taken from the browser, as the schema is
// shared by everyone who opens this version.
export async function loadFormSchema(
  sourceUrl: string,
  sourceHash: string,
): Promise<FormSchema> {
  const stored = hasDatabase()
    ? await withDatabase(async (db) => {
        const [row] = await db
          .select({ schema: formSchemas.schema })
          .from(formSchemas)
          .where(eq(formSchemas.sourceHash, sourceHash))

        return row?.schema.schemaVersion === FORM_SCHEMA_VERSION
          ? row.schema
          : null
      })
    : null

  if (stored) return stored

  const bytes = await fetchPdfBytes(sourceUrl)

  if ((await sha256Hex(bytes)) !== sourceHash) {
    throw new UserError(
      'This form has changed on the city’s website since you opened it. Reload the page to check the newest version.',
    )
  }

  const schema = await buildFormSchema(sourceUrl, sourceHash, bytes)

  if (hasDatabase()) {
    await withDatabase((db) =>
      db
        .insert(formSchemas)
        .values({ sourceHash, schemaVersion: schema.schemaVersion, schema })
        .onConflictDoUpdate({
          target: formSchemas.sourceHash,
          set: { schemaVersion: schema.schemaVersion, schema },
        }),
    )
  }

  return schema
}

async function buildFormSchema(
  sourceUrl: string,
  sourceHash: string,
  bytes: ArrayBuffer,
): Promise<FormSchema> {
  const form = await extractForm(bytes)
  const title = form.title ?? draftTitle(sourceUrl)
  const fields = await classifyFields(title, form.fields)

  console.log(
    JSON.stringify({
      message: 'form schema built',
      sourceHash,
      title,
      fields: fields.length,
      withRole: fields.filter(({ role }) => role).length,
      officeUse: fields.filter(({ officeUse }) => officeUse).length,
      markedRequired: fields.filter(({ markedRequired }) => markedRequired)
        .length,
      workTypes: fields.filter(({ workType }) => workType).length,
      signatureLines: form.signatureLines.length,
    }),
  )

  return {
    schemaVersion: FORM_SCHEMA_VERSION,
    sourceHash,
    title,
    fields,
    signatureLines: form.signatureLines,
    lines: form.lines,
  }
}

// Asks Jev what each text field asks for, whether each checkbox names the
// work, whether staff fill it in, and whether the form marks it as required;
// code then picks each field's checks.
async function classifyFields(
  title: string,
  fields: Array<ExtractedField>,
): Promise<Array<FormFieldSchema>> {
  if (fields.length === 0) return []

  const client = createTypeSafeClient()
  const answers = new Map<string, FormAnswer>()
  const batches: Array<Array<ExtractedField>> = []

  for (let start = 0; start < fields.length; start += FIELDS_PER_REQUEST) {
    batches.push(fields.slice(start, start + FIELDS_PER_REQUEST))
  }

  const headings = [
    ...new Set(fields.flatMap(({ section }) => (section ? [section] : []))),
  ]

  // Whether each heading makes its fields required, by heading.
  const requiredHeadings = new Set<string>()

  const askHeadings = async () => {
    if (headings.length === 0) return

    const result = await client.systemOne({
      state: { form: { title } },
      questions: Object.fromEntries(
        headings.map((heading, index) => [
          `h${index}`,
          headingRequiredQuestion(heading),
        ]),
      ),
    })

    headings.forEach((heading, index) => {
      if (readNoul(result.answers[`h${index}`]) >= YES_THRESHOLD) {
        requiredHeadings.add(heading)
      }
    })
  }

  try {
    await Promise.all([
      askHeadings(),
      ...batches.map(async (batch, batchIndex) => {
        const questions: Record<string, FormQuestion> = {}

        batch.forEach((field, index) => {
          const key = `f${batchIndex * FIELDS_PER_REQUEST + index}`

          const fieldQuestions =
            field.kind === 'checkbox'
              ? checkboxQuestions(field)
              : field.kind === 'text'
                ? textFieldQuestions(field)
                : choiceFieldQuestions(field)

          for (const [name, question] of Object.entries(fieldQuestions)) {
            questions[`${key}_${name}`] = question
          }
        })

        const result = await client.systemOne({
          state: { form: { title } },
          questions,
        })

        for (const [key, answer] of Object.entries(result.answers)) {
          answers.set(key, answer)
        }
      }),
    ])
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'form field classification failed',
        fields: fields.length,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    throw new UserError('Form checking is temporarily unavailable.')
  }

  return fields.map((field, index) => {
    const key = `f${index}`
    const noulOf = (name: string) => readNoul(answers.get(`${key}_${name}`))
    const officeUse = noulOf('officeUse') >= YES_THRESHOLD

    const markedRequired =
      field.requiredFlag ||
      noulOf('markedRequired') >= YES_THRESHOLD ||
      (field.section !== null && requiredHeadings.has(field.section))

    const workType =
      field.kind === 'checkbox' && noulOf('workType') >= YES_THRESHOLD

    const roleAnswer = answers.get(`${key}_role`)
    const role = roleAnswer?.type === 'choice' ? readRole(roleAnswer) : null

    return {
      ...field,
      role,
      workType,
      officeUse,
      markedRequired,
      checks: checksFor(field.kind, role, workType, officeUse, markedRequired),
    }
  })
}

function readNoul(answer: FormAnswer | undefined) {
  if (answer?.type !== 'noul') {
    throw new Error('Form classification is missing an answer.')
  }

  return answer.noul
}
