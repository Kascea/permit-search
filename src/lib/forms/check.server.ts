import type { NoulResponse, ScoreResponse } from '@typesafe-ai/sdk'

import type { DraftContent, NativeValue, PlacedField } from '#/lib/drafts/types'
import { UserError } from '#/lib/errors'
import {
  DESCRIPTION_VAGUE_MESSAGE,
  VAGUE_MIN_PROBABILITY,
  YES_THRESHOLD,
  dateCurrentIssue,
  formatIssue,
  isAlwaysMissing,
  missingMessage,
  noulSeverity,
  projectMismatchMessage,
  sameValue,
  sortIssues,
  unsignedMessage,
  valueFitsMessage,
  workTypeMessage,
} from '#/lib/forms/checks'
import type {
  CheckId,
  DraftCheckResult,
  FieldIssue,
  IssueTarget,
} from '#/lib/forms/checks'
import { describeField } from '#/lib/forms/labels'
import {
  agreesWithProjectQuestion,
  boxAppliesQuestion,
  descriptionSpecificQuestion,
  projectState,
  valueFitsQuestion,
  workTypeIncludedQuestion,
} from '#/lib/forms/questions'
import type {
  FieldView,
  FormQuestion,
  QuestionState,
} from '#/lib/forms/questions'
import { roleFillKey } from '#/lib/forms/roles'
import type { FormFieldSchema, FormSchema, PageRect } from '#/lib/forms/types'
import { fillValues } from '#/lib/projects/autofill'
import { formatCost } from '#/lib/projects/types'
import type { Project } from '#/lib/projects/types'
import { createTypeSafeClient } from '#/lib/search/typesafe.server'

// Questions per Jev request. They share the form's state, which is read once
// per request.
const QUESTIONS_PER_REQUEST = 40

// How far, in PDF points, a placed signature can be from a signature line
// and still sign it.
const SIGNATURE_REACH = 60

const FORMAT_CHECKS: Array<CheckId> = [
  'format.email',
  'format.phone',
  'format.zip',
  'format.money',
  'format.date',
]

// A question and how its answer becomes issues.
interface PendingQuestion {
  question: FormQuestion
  read: (answer: NoulResponse | ScoreResponse) => Array<FieldIssue>
}

// One field to check: a PDF field or one the user placed.
interface CheckedField {
  target: IssueTarget
  view: FieldView
  rect: PageRect
  checks: Array<CheckId>
  schema?: FormFieldSchema
  text: string
  checked: boolean
}

// A checkbox's value is a boolean; it has no text.
function textOf(value: NativeValue | undefined) {
  if (value === undefined || value === true || value === false) return ''

  return Array.isArray(value) ? value.join(', ').trim() : value.trim()
}

// The fields to check, with their current values.
function fieldsToCheck(schema: FormSchema, content: DraftContent) {
  const fields: Array<CheckedField> = schema.fields
    .filter(({ checks }) => checks.length > 0)
    .map((field) => {
      const value = content.nativeValues[field.name]

      return {
        target: { kind: 'native', name: field.name },
        view: field,
        rect: field.rect,
        checks: field.checks,
        schema: field,
        text: textOf(value),
        checked: value === true,
      }
    })

  // Text and dates the user placed on the page are named from the printed
  // text around them, like the PDF's own fields; they can't be assigned a
  // role yet. A placed date is nearly always the date beside a signature.
  for (const placed of content.placedFields) {
    if (
      (placed.kind !== 'text' && placed.kind !== 'date') ||
      !placed.value.trim()
    ) {
      continue
    }

    fields.push({
      target: { kind: 'placed', id: placed.id },
      view: describeField(placed, schema.lines, [], false),
      rect: placed,
      checks:
        placed.kind === 'date'
          ? ['format.date', 'dateCurrent']
          : ['valueFitsLabel', 'matchesProject'],
      text: placed.value.trim(),
      checked: false,
    })
  }

  return fields
}

function issueAt(
  field: CheckedField,
  check: CheckId,
  issue: Pick<FieldIssue, 'severity' | 'message' | 'score'>,
): FieldIssue {
  return {
    target: field.target,
    check,
    label: field.view.label,
    section: field.view.section,
    pageIndex: field.rect.pageIndex,
    ...issue,
  }
}

// Whether a signature line has a signature: one the user placed near it, or
// a filled field on its row.
function isSigned(
  line: PageRect,
  placedFields: Array<PlacedField>,
  fields: Array<CheckedField>,
) {
  return (
    placedFields.some(
      (placed) =>
        placed.kind === 'signature' &&
        placed.value.trim() &&
        placed.pageIndex === line.pageIndex &&
        Math.abs(placed.y - line.y) <= SIGNATURE_REACH,
    ) ||
    fields.some(
      (field) =>
        field.schema?.role === 'signature' &&
        field.text &&
        field.rect.pageIndex === line.pageIndex &&
        Math.abs(field.rect.y - line.y) <= SIGNATURE_REACH,
    )
  )
}

// Runs a draft's checks: code checks here, and Jev checks bundled into as few
// requests as fit.
export async function checkDraft(
  schema: FormSchema,
  content: DraftContent,
  project: Project | null,
): Promise<DraftCheckResult> {
  const fields = fieldsToCheck(schema, content)
  const issues: Array<FieldIssue> = []
  const pending: Array<PendingQuestion> = []
  const projectValues = project ? fillValues(project) : {}

  // The description of work the work-type checks compare against: the
  // form's own, else the project's.
  const work =
    fields.find(
      (field) => field.schema?.role === 'workDescription' && field.text,
    )?.text ||
    project?.details.workDescription ||
    ''

  // Empty required fields, waiting on whether each applies.
  const emptyRequired: Array<CheckedField> = []

  for (const field of fields) {
    const { checks, text } = field

    if (!text && !field.checked) {
      if (checks.includes('required')) {
        if (field.schema && isAlwaysMissing(field.schema)) {
          issues.push(
            issueAt(field, 'required', {
              severity: 'missing',
              message: missingMessage(
                field.view.label,
                field.schema.kind === 'checkbox',
              ),
            }),
          )
        } else {
          emptyRequired.push(field)
        }
      }

      continue
    }

    for (const check of FORMAT_CHECKS) {
      const message = checks.includes(check) ? formatIssue(check, text) : null

      if (message) {
        issues.push(issueAt(field, check, { severity: 'error', message }))
      }
    }

    const staleDate = checks.includes('dateCurrent')
      ? dateCurrentIssue(text)
      : null

    if (staleDate) {
      issues.push(
        issueAt(field, 'dateCurrent', {
          severity: 'review',
          message: staleDate,
        }),
      )
    }

    if (checks.includes('valueFitsLabel') && text) {
      pending.push({
        question: valueFitsQuestion(field.view, text),
        read: (answer) => {
          const noul = 'noul' in answer ? answer.noul : 1
          const severity = noulSeverity(noul)

          return severity
            ? [
                issueAt(field, 'valueFitsLabel', {
                  severity,
                  message: valueFitsMessage(severity, text, field.view.label),
                  score: noul,
                }),
              ]
            : []
        },
      })
    }

    if (checks.includes('matchesProject') && project && text) {
      const role = field.schema?.role
      const fillKey = role ? roleFillKey(role) : undefined
      const projectValue = fillKey ? projectValues[fillKey] : undefined

      const shownProjectValue =
        fillKey === 'estimatedCost' && project.details.estimatedCost !== null
          ? formatCost(project.details.estimatedCost)
          : projectValue

      // The same value needs no question.
      if (!projectValue || !sameValue(text, projectValue)) {
        pending.push({
          question: agreesWithProjectQuestion(field.view, text),
          read: (answer) => {
            const noul = 'noul' in answer ? answer.noul : 1
            const severity = noulSeverity(noul)

            // Unsure only matters when code found the values different.
            if (!severity || (severity === 'review' && !projectValue)) {
              return []
            }

            return [
              issueAt(field, 'matchesProject', {
                severity,
                message: projectMismatchMessage(
                  severity,
                  text,
                  project.name,
                  shownProjectValue,
                ),
                score: noul,
              }),
            ]
          },
        })
      }
    }

    if (
      checks.includes('workTypeMatchesDescription') &&
      field.checked &&
      work
    ) {
      pending.push({
        question: workTypeIncludedQuestion(field.view),
        read: (answer) => {
          const noul = 'noul' in answer ? answer.noul : 1
          const severity = noulSeverity(noul)

          return severity
            ? [
                issueAt(field, 'workTypeMatchesDescription', {
                  severity,
                  message: workTypeMessage(severity, field.view.label),
                  score: noul,
                }),
              ]
            : []
        },
      })
    }

    if (checks.includes('descriptionSpecific') && text) {
      pending.push({
        question: descriptionSpecificQuestion(text),
        read: (answer) => {
          const vague = 'score' in answer ? (answer.probabilities[0] ?? 0) : 0

          return vague >= VAGUE_MIN_PROBABILITY
            ? [
                issueAt(field, 'descriptionSpecific', {
                  severity: 'review',
                  message: DESCRIPTION_VAGUE_MESSAGE,
                  score: vague,
                }),
              ]
            : []
        },
      })
    }
  }

  const checkedBoxes = schema.fields
    .filter(
      (field) =>
        field.kind === 'checkbox' && content.nativeValues[field.name] === true,
    )
    .map(({ label, section, line }) => ({ label, section, line }))

  // An empty required field: ask whether it applies to this application.
  for (const field of emptyRequired) {
    pending.push({
      question: boxAppliesQuestion(field.schema ?? field.view, checkedBoxes),
      read: (answer) => {
        const noul = 'noul' in answer ? answer.noul : 1

        // Unsure means the form gave Jev nothing to go on; reporting it would
        // only add noise.
        if (noul < YES_THRESHOLD) return []

        return [
          issueAt(field, 'required', {
            severity: 'missing',
            message: missingMessage(
              field.view.label,
              field.schema?.kind === 'checkbox',
            ),
            score: noul,
          }),
        ]
      },
    })
  }

  for (const line of schema.signatureLines) {
    if (!isSigned(line, content.placedFields, fields)) {
      issues.push({
        target: { kind: 'signature', pageIndex: line.pageIndex },
        check: 'signed',
        severity: 'missing',
        label: line.label,
        section: null,
        pageIndex: line.pageIndex,
        message: unsignedMessage(line.label),
      })
    }
  }

  // Text fields with a role of signature, such as a typed-name signature box.
  for (const field of fields) {
    if (field.checks.includes('signed') && !field.text) {
      issues.push(
        issueAt(field, 'signed', {
          severity: 'missing',
          message: unsignedMessage(field.view.label),
        }),
      )
    }
  }

  issues.push(...(await askJev(schema, work, project, pending)))

  return {
    issues: sortIssues(issues),
    checkedFields: fields.length,
    projectName: project?.name ?? null,
  }
}

async function askJev(
  schema: FormSchema,
  work: string,
  project: Project | null,
  pending: Array<PendingQuestion>,
) {
  if (pending.length === 0) return []

  // Shared by every question: the form, the description of work, and the
  // project, each only when there is one.
  const state: QuestionState = {
    form: { title: schema.title },
  }

  if (work) state.descriptionOfWork = work

  if (project) state.project = projectState(project)

  const client = createTypeSafeClient()
  const batches: Array<Array<PendingQuestion>> = []

  for (let start = 0; start < pending.length; start += QUESTIONS_PER_REQUEST) {
    batches.push(pending.slice(start, start + QUESTIONS_PER_REQUEST))
  }

  try {
    const answered = await Promise.all(
      batches.map(async (batch) => {
        const questions = Object.fromEntries(
          batch.map(({ question }, index) => [`q${index}`, question]),
        )

        const { answers } = await client.systemOne({ state, questions })

        return batch.flatMap(({ read }, index) => {
          const answer = answers[`q${index}`]

          if (!answer || answer.type === 'choice') {
            throw new Error(`Draft check is missing answer q${index}.`)
          }

          return read(answer)
        })
      }),
    )

    const issues = answered.flat()

    console.log(
      JSON.stringify({
        message: 'jev draft check completed',
        sourceHash: schema.sourceHash,
        questions: pending.length,
        issues: issues.map(({ check, label, severity, score }) => ({
          check,
          label,
          severity,
          score,
        })),
      }),
    )

    return issues
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'jev draft check failed',
        sourceHash: schema.sourceHash,
        questions: pending.length,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    throw new UserError('Form checking is temporarily unavailable.')
  }
}
