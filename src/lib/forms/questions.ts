import { choice, noul, score } from '@typesafe-ai/sdk'
import type {
  ChoiceQuestion,
  ChoiceResponse,
  ContentValue,
  NoulQuestion,
  ScoreQuestion,
} from '@typesafe-ai/sdk'

import { FIELD_ROLES, isFieldRole } from '#/lib/forms/roles'
import type { FieldRole } from '#/lib/forms/roles'
import { formatCost, formatProjectAddress } from '#/lib/projects/types'
import type { Project } from '#/lib/projects/types'

// Every question Jev is asked about a form: when it's first read (what each
// field asks for), and when the user checks a draft.

// A field as Jev sees it: its printed label, the heading it's under, and the
// line it's on with the field marked.
export interface FieldView {
  label: string
  section: string | null
  line: string
}

// A field's printed text as sent to Jev, by name: label, section and line.
type FieldContext = { [key: string]: string }

// Leaves out a missing section rather than sending null.
function fieldContext(field: FieldView) {
  const { label, section, line } = field

  return Object.fromEntries(
    Object.entries({ label, section, line }).flatMap<[string, string]>(
      ([key, value]) => (value ? [[key, value]] : []),
    ),
  ) satisfies FieldContext
}

const ROLE_OPTIONS = Object.fromEntries(
  Object.entries(FIELD_ROLES).map(([role, { describe }]) => [role, describe]),
)

// A role is kept only when Jev gives it at least this probability; otherwise
// the field gets the generic checks.
const ROLE_MIN_PROBABILITY = 0.5

// Ingest: what a text field asks for, whether staff fill it in, and whether
// the form marks it as required.
export function textFieldQuestions(field: FieldView) {
  return {
    role: choice(
      {
        question:
          'What does `field` on this permit application ask the applicant to write?',
        field: fieldContext(field),
      },
      ROLE_OPTIONS,
    ),
    officeUse: officeUseQuestion(field),
    markedRequired: markedRequiredQuestion(field),
  }
}

// Ingest: whether a checkbox names the work, whether staff fill it in, and
// whether the form marks it as required.
export function checkboxQuestions(field: FieldView) {
  return {
    workType: noul(
      {
        question:
          'Does checkbox `field` name a kind of work, structure or equipment that the permit is for?',
        field: fieldContext(field),
      },
      {
        true: 'The box names what is being built, installed or changed, such as Deck, Privacy fence, Furnace, Addition or Re-roof.',
        false:
          'The box answers something else, such as who the applicant is, how the property is used, where on the lot the work is, or which documents are attached.',
      },
    ),
    officeUse: officeUseQuestion(field),
    markedRequired: markedRequiredQuestion(field),
  }
}

// Ingest: for dropdowns, lists and radio buttons, only whether staff fill it
// in and whether it's marked as required.
export function choiceFieldQuestions(field: FieldView) {
  return {
    officeUse: officeUseQuestion(field),
    markedRequired: markedRequiredQuestion(field),
  }
}

// What the printed form says, not whether the field matters: whether the
// work needs it is the section question's job at check time. Only the
// field's own label and line; its heading is asked about once, in
// headingRequiredQuestion.
function markedRequiredQuestion(field: FieldView) {
  return noul(
    {
      question: 'Is `field` marked as required on its own label or line?',
      field: { label: field.label, line: field.line },
    },
    {
      true: 'An asterisk or the word “required” is printed beside this field’s label.',
      false:
        'Nothing beside this field’s label marks it as required, or it is marked optional.',
    },
  )
}

// Ingest: whether a section heading makes every field under it required, as
// "Property owner *REQUIRED*" does.
export function headingRequiredQuestion(heading: string) {
  return noul(
    {
      question: 'Does `heading` mark the fields under it as required?',
      heading,
    },
    {
      true: 'The heading carries a required marker for its own section, such as an asterisk, “*REQUIRED*” or “(required)”.',
      false:
        'The heading has no required marker for its section: it only names the section, marks it optional or “if applicable”, or says that something else is required, such as an inspection or a document.',
    },
  )
}

function officeUseQuestion(field: FieldView) {
  return noul(
    {
      question: 'Is `field` for city staff to fill in?',
      field: fieldContext(field),
    },
    {
      true: 'The field is in an office-use-only section, or records something the city decides, such as the permit number, fee, receipt, approval or date issued.',
      false:
        'The applicant fills in the field, such as their name, the address, the work, or the date they sign.',
    },
  )
}

export function readRole(answer: ChoiceResponse): FieldRole | null {
  const probability = answer.probabilities[answer.choice] ?? 0

  return isFieldRole(answer.choice) && probability >= ROLE_MIN_PROBABILITY
    ? answer.choice
    : null
}

// Check: whether a filled value is what its field asks for.
export function valueFitsQuestion(
  field: FieldView,
  value: string,
): NoulQuestion {
  return noul(
    {
      question: 'Is `value` the kind of information that `field` asks for?',
      field: fieldContext(field),
      value,
    },
    {
      true: 'For example, a phone number in a phone field, a person’s or company’s name in a name field, or a street address in an address field.',
      false:
        'The value belongs in a different field, such as an email address in a phone field, a dollar amount in a license number field, or a description of the work in a name field.',
    },
  )
}

// Check: whether a checked work-type box is part of the work described in
// the state's `descriptionOfWork`.
export function workTypeIncludedQuestion(field: FieldView): NoulQuestion {
  return noul(
    {
      question: 'Does the work in `descriptionOfWork` include `option`?',
      option: fieldContext(field),
    },
    {
      true: 'The description says or clearly implies this kind of work, structure or equipment.',
      false:
        'The description is about different work, and neither says nor implies this.',
    },
  )
}

// Check: how specific the description of work written on the form is.
export function descriptionSpecificQuestion(
  description: string,
): ScoreQuestion {
  return score(
    {
      question:
        'How specific is `description` as the description of work on a permit application?',
      description,
    },
    [
      'It names the project only, such as “fence” or “new furnace”.',
      'It says what is being done and adds one detail, such as the size, material or location.',
      'It says what is being done with several details, such as the size, materials and where on the property.',
    ],
  )
}

// Check: whether a section with empty fields applies to this application,
// given the boxes the applicant checked (such as "Owner and occupant") and
// the state's `project`, when there is one.
export function sectionAppliesQuestion(
  section: string,
  labels: Array<string>,
  checkedBoxes: Array<FieldView>,
): NoulQuestion {
  return noul(
    {
      question:
        'Does the applicant need to fill in `section` on this application?',
      section: { heading: section, fields: labels },
      checkedBoxes: checkedBoxes.map((box) => fieldContext(box)),
    },
    {
      true: 'The section asks about a person or place this project has, such as the property owner, the job site, or a contractor when one is hired.',
      false:
        'The section is marked optional or “if applicable” and doesn’t apply, such as a contractor section when the owner is doing the work.',
    },
  )
}

// Check: whether a filled value agrees with the form's project, given as the
// state's `project`.
export function agreesWithProjectQuestion(
  field: FieldView,
  value: string,
): NoulQuestion {
  return noul(
    {
      question:
        'Does `value`, written in `field`, agree with the details in `project`?',
      field: fieldContext(field),
      value,
    },
    {
      true: 'The project has the same detail, perhaps written differently or abbreviated, or the project doesn’t say what belongs in this field.',
      false:
        'The value contradicts the project, such as a different address, phone number, name or cost than the project has for that person or place.',
    },
  )
}

// The state sent with a request: named parts the questions refer to, such
// as `work` and `project`.
export type QuestionState = { [key: string]: ContentValue }

// The filled entries only, or nothing when none are.
function filledGroup(entries: { [key: string]: string }) {
  const filled = Object.entries(entries).filter(([, value]) => value)

  return filled.length > 0 ? Object.fromEntries(filled) : undefined
}

// The project as the questions see it: only the details it has, grouped by
// whom they're about.
export function projectState(project: Project): QuestionState {
  const { details } = project

  const owner = filledGroup({
    name: details.ownerName,
    phone: details.ownerPhone,
    email: details.ownerEmail,
    mailingAddress: details.ownerMailingAddress,
  })

  const entries: Array<[string, ContentValue | undefined]> = [
    ['name', project.name],
    ['jobSite', formatProjectAddress(project)],
    ['parcelNumber', details.parcelNumber],
    ['workDescription', details.workDescription],
    [
      'estimatedCost',
      details.estimatedCost === null
        ? undefined
        : formatCost(details.estimatedCost),
    ],
    ['owner', owner],
    [
      'applicant',
      details.applicantIsOwner
        ? owner && 'The property owner'
        : filledGroup({
            name: details.applicantName,
            phone: details.applicantPhone,
            email: details.applicantEmail,
          }),
    ],
    [
      'contractor',
      filledGroup({
        company: details.contractorCompany,
        license: details.contractorLicense,
        phone: details.contractorPhone,
        email: details.contractorEmail,
      }),
    ],
    [
      'otherDetails',
      filledGroup(
        Object.fromEntries(
          project.extraFields.map(({ label, value }) => [label, value]),
        ),
      ),
    ],
  ]

  return Object.fromEntries(
    entries.flatMap<[string, ContentValue]>(([key, value]) =>
      value ? [[key, value]] : [],
    ),
  )
}

export type FormQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion
