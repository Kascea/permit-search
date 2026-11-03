import type { FieldRole } from '#/lib/forms/roles'
import type { FormFieldKind } from '#/lib/forms/types'

// The checks a form can get, which fields get which, and how each finding is
// worded. Code checks are rules; Jev checks ask questions (see
// questions.ts) and are read back here.

// A Noul at or above YES counts as yes; at or below NO as no. Between, Jev
// isn't sure, and the user is asked to look.
export const YES_THRESHOLD = 0.7
export const NO_THRESHOLD = 0.3

export const CHECKS = {
  'format.email': { runner: 'code', describe: 'Is an email address' },
  'format.phone': { runner: 'code', describe: 'Is a phone number' },
  'format.zip': { runner: 'code', describe: 'Is a ZIP code' },
  'format.money': { runner: 'code', describe: 'Is a dollar amount' },
  'format.date': { runner: 'code', describe: 'Is a date' },
  dateCurrent: {
    runner: 'code',
    describe: 'Is a recent date, not one from weeks ago or in the future',
  },
  // Code compares fields whose role maps to a project value; Jev compares
  // the rest, and anything code finds different, against the whole project.
  matchesProject: {
    runner: 'jev',
    describe: 'Agrees with the details saved in the form’s project',
  },
  required: {
    runner: 'jev',
    describe:
      'Is filled in, unless Jev says its section doesn’t apply to this application',
  },
  signed: { runner: 'code', describe: 'Has a signature' },
  valueFitsLabel: {
    runner: 'jev',
    describe: 'Holds the kind of information its label asks for',
  },
  workTypeMatchesDescription: {
    runner: 'jev',
    describe: 'When checked, names work that the description of work includes',
  },
  descriptionSpecific: {
    runner: 'jev',
    describe: 'Describes the work specifically enough for a permit',
  },
} as const satisfies Record<
  string,
  { runner: 'code' | 'jev'; describe: string }
>

export type CheckId = keyof typeof CHECKS

// The checks for each role. Every role is listed, so a new role won't
// compile until its checks are chosen.
export const CHECKS_BY_ROLE: Record<FieldRole, Array<CheckId>> = {
  propertyAddress: ['required', 'matchesProject', 'valueFitsLabel'],
  propertyUnit: ['matchesProject'],
  propertyZip: ['required', 'format.zip', 'matchesProject'],
  parcelNumber: ['matchesProject', 'valueFitsLabel'],
  workDescription: ['required', 'descriptionSpecific'],
  estimatedCost: ['required', 'format.money', 'matchesProject'],
  ownerName: ['required', 'matchesProject', 'valueFitsLabel'],
  ownerPhone: ['format.phone', 'matchesProject'],
  ownerEmail: ['format.email', 'matchesProject'],
  ownerMailingAddress: ['matchesProject', 'valueFitsLabel'],
  applicantName: ['required', 'matchesProject', 'valueFitsLabel'],
  applicantPhone: ['format.phone', 'matchesProject'],
  applicantEmail: ['format.email', 'matchesProject'],
  contractorCompany: ['required', 'matchesProject', 'valueFitsLabel'],
  contractorLicense: ['matchesProject', 'valueFitsLabel'],
  contractorPhone: ['format.phone', 'matchesProject'],
  contractorEmail: ['format.email', 'matchesProject'],
  signature: ['signed'],
  signatureDate: ['required', 'format.date', 'dateCurrent'],
  projectDate: ['format.date'],
  other: ['valueFitsLabel', 'matchesProject'],
}

// The checks for one field. Office-use fields get none; checkboxes only
// the work-type check; a text field Jev couldn't place the generic ones.
// A field the form marks as required (see FormFieldSchema.markedRequired)
// also gets the required check, whatever its kind or role.
export function checksFor(
  kind: FormFieldKind,
  role: FieldRole | null,
  workType: boolean,
  officeUse: boolean,
  markedRequired: boolean,
): Array<CheckId> {
  if (officeUse) return []

  const checks: Array<CheckId> =
    kind === 'checkbox'
      ? workType
        ? ['workTypeMatchesDescription']
        : []
      : kind !== 'text'
        ? []
        : role
          ? CHECKS_BY_ROLE[role]
          : ['valueFitsLabel', 'matchesProject']

  return markedRequired &&
    !checks.includes('required') &&
    !(role && NEVER_REQUIRED_ROLES.has(role))
    ? ['required', ...checks]
    : checks
}

// Roles a heading's "required" can't make required: most addresses have no
// unit number.
const NEVER_REQUIRED_ROLES: ReadonlySet<FieldRole> = new Set(['propertyUnit'])

// Required roles that apply to every application, so an empty one is
// always missing. Any other required field under a heading is missing only
// if Jev says its section applies: a contractor section doesn't when the
// owner does the work.
export const ALWAYS_APPLIES_ROLES: ReadonlySet<FieldRole> = new Set([
  'propertyAddress',
  'propertyZip',
  'workDescription',
  'estimatedCost',
  'signatureDate',
])

export type IssueSeverity = 'error' | 'review' | 'missing'

// Where a finding is: one of the PDF's fields, a field the user placed, or a
// printed signature line.
export type IssueTarget =
  | { kind: 'native'; name: string }
  | { kind: 'placed'; id: string }
  | { kind: 'signature'; pageIndex: number }

export interface FieldIssue {
  target: IssueTarget
  check: CheckId
  severity: IssueSeverity
  // The field's printed label, such as "Phone".
  label: string
  section: string | null
  pageIndex: number
  // Written for the user.
  message: string
  // The Jev probability or score behind it, for logs.
  score?: number
}

export interface DraftCheckResult {
  issues: Array<FieldIssue>
  // How many fields were checked, for "12 fields checked".
  checkedFields: number
  // The project the draft was compared with, if any.
  projectName: string | null
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  error: 0,
  missing: 1,
  review: 2,
}

// When one field fails several checks, the user sees the most specific:
// a wrong kind of value before a format, before a project mismatch.
const CHECK_ORDER: Array<CheckId> = [
  'signed',
  'required',
  'valueFitsLabel',
  'format.email',
  'format.phone',
  'format.zip',
  'format.money',
  'format.date',
  'dateCurrent',
  'matchesProject',
  'workTypeMatchesDescription',
  'descriptionSpecific',
]

function targetKey(target: IssueTarget) {
  return target.kind === 'native'
    ? `native:${target.name}`
    : target.kind === 'placed'
      ? `placed:${target.id}`
      : `signature:${target.pageIndex}`
}

// One finding per field, worst first, then in page order.
export function sortIssues(issues: Array<FieldIssue>) {
  const byField = new Map<string, FieldIssue>()

  for (const issue of issues) {
    const key =
      issue.target.kind === 'signature'
        ? `${targetKey(issue.target)}:${issue.label}`
        : targetKey(issue.target)

    const kept = byField.get(key)

    if (
      !kept ||
      SEVERITY_ORDER[issue.severity] < SEVERITY_ORDER[kept.severity] ||
      (issue.severity === kept.severity &&
        CHECK_ORDER.indexOf(issue.check) < CHECK_ORDER.indexOf(kept.check))
    ) {
      byField.set(key, issue)
    }
  }

  return [...byField.values()].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.pageIndex - b.pageIndex,
  )
}

function quote(value: string) {
  const short = value.length > 40 ? `${value.slice(0, 39)}…` : value

  return `“${short}”`
}

// The code checks for one filled value. Each returns a message when the
// value fails.
const FORMAT_CHECKS: Partial<
  Record<CheckId, (value: string) => string | null>
> = {
  'format.email': (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
      ? null
      : `${quote(value)} isn’t an email address.`,
  'format.phone': (value) => {
    const digits = value
      .replace(/\s*(?:ext|x)\.?\s*\d+$/i, '')
      .replace(/\D/g, '')

    return digits.length === 10 ||
      (digits.length === 11 && digits.startsWith('1'))
      ? null
      : `${quote(value)} isn’t a 10-digit phone number.`
  },
  'format.zip': (value) =>
    /^\d{5}(?:-\d{4})?$/.test(value)
      ? null
      : `${quote(value)} isn’t a ZIP code.`,
  'format.money': (value) =>
    /^\$?\s*\d{1,3}(?:,?\d{3})*(?:\.\d{2})?$/.test(value)
      ? null
      : `${quote(value)} isn’t a dollar amount, such as $12,500.`,
  'format.date': (value) =>
    parseDate(value) ? null : `${quote(value)} isn’t a date.`,
}

// A calendar date, or null when it isn't one, such as 2/30/2026.
function calendarDate(year: number, month: number, day: number) {
  const date = new Date(year < 100 ? 2000 + year : year, month - 1, day)

  return date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

// MM/DD/YYYY, M/D/YY, YYYY-MM-DD, or "March 4, 2026".
function parseDate(value: string) {
  const slashed = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value)

  if (slashed) {
    return calendarDate(
      Number(slashed[3]),
      Number(slashed[1]),
      Number(slashed[2]),
    )
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  if (!/[a-z]{3}/i.test(value)) return null

  const time = Date.parse(value)

  return Number.isNaN(time) ? null : new Date(time)
}

// A signature date older than this, in days, was likely filled in long
// before the form is signed.
const STALE_DATE_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

// A date filled in long before signing, or one in the future. The server's
// clock may be a day off the user's, so a day either way is allowed.
export function dateCurrentIssue(value: string, now = new Date()) {
  const date = parseDate(value)

  if (!date) return null

  const daysAgo = Math.floor((now.getTime() - date.getTime()) / DAY_MS)

  if (daysAgo > STALE_DATE_DAYS) {
    return `This date is ${daysAgo} days ago. Change it to the day you sign?`
  }

  if (daysAgo < -1) return 'This date is in the future. Use the day you sign.'

  return null
}

export function formatIssue(check: CheckId, value: string) {
  return FORMAT_CHECKS[check]?.(value) ?? null
}

// Compares as people would: case, spacing, punctuation, and a phone number's
// formatting don't count.
function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function sameValue(value: string, projectValue: string) {
  return normalize(value) === normalize(projectValue)
}

// A no from Jev is an error; unsure asks the user to look only when code
// also found the values different.
export function projectMismatchMessage(
  severity: IssueSeverity,
  value: string,
  projectName: string,
  projectValue?: string,
) {
  const saved = projectValue
    ? `Your project “${projectName}” has ${quote(projectValue)}.`
    : `It doesn’t match your project “${projectName}”.`

  return severity === 'error'
    ? `${quote(value)} looks wrong. ${saved}`
    : `Check ${quote(value)}. ${saved}`
}

// valueFitsLabel and workTypeMatchesDescription: a no is an error, an
// unsure answer asks the user to look.
export function noulSeverity(noul: number): IssueSeverity | null {
  if (noul <= NO_THRESHOLD) return 'error'

  if (noul < YES_THRESHOLD) return 'review'

  return null
}

export function valueFitsMessage(
  severity: IssueSeverity,
  value: string,
  label: string,
) {
  return severity === 'error'
    ? `${quote(value)} doesn’t look like what ${quote(label)} asks for.`
    : `Check that ${quote(value)} belongs in ${quote(label)}.`
}

export function workTypeMessage(severity: IssueSeverity, label: string) {
  return severity === 'error'
    ? `${quote(label)} is checked, but the description of work doesn’t include it.`
    : `${quote(label)} is checked. Check that it’s part of this work.`
}

// The description-of-work Score's levels run from 0, naming the project
// only, to 2, several details. It's vague when level 0 is at least this
// likely; the levels' probabilities separate clearly, unlike the expected
// score, which a one-detail description pulls toward the middle.
export const VAGUE_MIN_PROBABILITY = 0.5

export const DESCRIPTION_VAGUE_MESSAGE =
  'The description of work is vague. Cities usually want what you’re building, its size, materials and location.'

export function missingMessage(label: string, isCheckbox: boolean) {
  return isCheckbox ? `${quote(label)} isn’t checked.` : `${label} is empty.`
}

export function unsignedMessage(label: string) {
  return `${label} isn’t signed. Add one with the Signature tool.`
}
