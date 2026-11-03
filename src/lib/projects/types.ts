import { z } from 'zod'

import type { SearchLink } from '#/lib/navigation/origin'

// A PDF saved to a project.
export interface ProjectItem {
  sourceUrl: string
  title: string
  // Sent when adding: the public ID of the saved search it was found in.
  searchId?: string
  // Read back: that search, for linking to it.
  search?: SearchLink
}

// The answers nearly every permit application asks for. Each is its own column
// on projects; empty text is stored as null and comes back as "".
export interface ProjectDetails {
  streetAddress: string
  unit: string
  zipCode: string
  // Also called PIN, APN or tax ID.
  parcelNumber: string

  workDescription: string
  // Whole dollars. Most cities base the permit fee on it.
  estimatedCost: number | null

  ownerName: string
  ownerPhone: string
  ownerEmail: string
  // Only when it differs from the property's address.
  ownerMailingAddress: string

  // Homeowners often file themselves; the applicant fields are then ignored
  // and the owner's are used.
  applicantIsOwner: boolean
  applicantName: string
  applicantPhone: string
  applicantEmail: string

  contractorCompany: string
  contractorLicense: string
  contractorPhone: string
  contractorEmail: string
}

export type ProjectTextKey = {
  [Key in keyof ProjectDetails]: ProjectDetails[Key] extends string
    ? Key
    : never
}[keyof ProjectDetails]

// Anything else a city's forms ask for, such as "Lot" or "Year built", added
// by the user. Kept in order in a jsonb column.
export interface ExtraField {
  label: string
  value: string
}

export interface Project {
  publicId: string
  name: string
  // The city of the work.
  city: { name: string; region: string } | null
  details: ProjectDetails
  extraFields: Array<ExtraField>
  // Newest first.
  items: Array<ProjectItem>
  updatedAt: string
}

// What the project form edits.
export type ProjectInput = Pick<
  Project,
  'name' | 'city' | 'details' | 'extraFields'
>

export type ProjectFieldGroup =
  'property' | 'work' | 'owner' | 'applicant' | 'contractor'

// The text fields, in form order. maxLength matches the column.
export const PROJECT_TEXT_FIELDS: Array<{
  key: ProjectTextKey
  group: ProjectFieldGroup
  label: string
  maxLength: number
  type?: 'tel' | 'email'
  autoComplete?: string
  placeholder?: string
  hint?: string
  multiline?: boolean
}> = [
  {
    key: 'streetAddress',
    group: 'property',
    label: 'Street address',
    maxLength: 200,
    autoComplete: 'address-line1',
    placeholder: '123 Main St',
  },
  {
    key: 'unit',
    group: 'property',
    label: 'Unit or suite',
    maxLength: 40,
    autoComplete: 'address-line2',
  },
  {
    key: 'zipCode',
    group: 'property',
    label: 'ZIP code',
    maxLength: 10,
    autoComplete: 'postal-code',
  },
  {
    key: 'parcelNumber',
    group: 'property',
    label: 'Parcel number',
    maxLength: 60,
    hint: 'Also called PIN, APN or tax ID. It’s on your property tax statement.',
  },
  {
    key: 'workDescription',
    group: 'work',
    label: 'Description of work',
    maxLength: 2_000,
    multiline: true,
    placeholder: 'e.g. Replace 120 ft of 6 ft wood privacy fence',
  },
  { key: 'ownerName', group: 'owner', label: 'Name', maxLength: 120 },
  {
    key: 'ownerPhone',
    group: 'owner',
    label: 'Phone',
    maxLength: 40,
    type: 'tel',
  },
  {
    key: 'ownerEmail',
    group: 'owner',
    label: 'Email',
    maxLength: 254,
    type: 'email',
  },
  {
    key: 'ownerMailingAddress',
    group: 'owner',
    label: 'Mailing address',
    maxLength: 300,
    hint: 'Only if it’s different from the property.',
  },
  { key: 'applicantName', group: 'applicant', label: 'Name', maxLength: 120 },
  {
    key: 'applicantPhone',
    group: 'applicant',
    label: 'Phone',
    maxLength: 40,
    type: 'tel',
  },
  {
    key: 'applicantEmail',
    group: 'applicant',
    label: 'Email',
    maxLength: 254,
    type: 'email',
  },
  {
    key: 'contractorCompany',
    group: 'contractor',
    label: 'Company',
    maxLength: 200,
  },
  {
    key: 'contractorLicense',
    group: 'contractor',
    label: 'License number',
    maxLength: 60,
  },
  {
    key: 'contractorPhone',
    group: 'contractor',
    label: 'Phone',
    maxLength: 40,
    type: 'tel',
  },
  {
    key: 'contractorEmail',
    group: 'contractor',
    label: 'Email',
    maxLength: 254,
    type: 'email',
  },
]

export const PROJECT_FIELD_GROUPS: Array<{
  id: ProjectFieldGroup
  title: string
  description: string
}> = [
  {
    id: 'property',
    title: 'Property',
    description: 'Where the work happens.',
  },
  {
    id: 'work',
    title: 'Scope of work',
    description: 'What you’re building or changing, and what it will cost.',
  },
  {
    id: 'owner',
    title: 'Property owner',
    description: 'The person or company on the title.',
  },
  {
    id: 'applicant',
    title: 'Applicant',
    description: 'The person filing the permit.',
  },
  {
    id: 'contractor',
    title: 'Contractor',
    description: 'Leave blank if you’re doing the work yourself.',
  },
]

// Offered when adding an extra field; asked for by many forms but not most.
export const SUGGESTED_EXTRA_FIELDS = [
  'Lot',
  'Block',
  'Subdivision',
  'Zoning district',
  'Year built',
  'Square footage',
]

export const EMPTY_PROJECT_DETAILS: ProjectDetails = {
  streetAddress: '',
  unit: '',
  zipCode: '',
  parcelNumber: '',
  workDescription: '',
  estimatedCost: null,
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
  ownerMailingAddress: '',
  applicantIsOwner: false,
  applicantName: '',
  applicantPhone: '',
  applicantEmail: '',
  contractorCompany: '',
  contractorLicense: '',
  contractorPhone: '',
  contractorEmail: '',
}

export const MAX_PROJECT_NAME_LENGTH = 120
export const MAX_ESTIMATED_COST = 1_000_000_000
export const MAX_EXTRA_FIELDS = 30
export const MAX_EXTRA_LABEL_LENGTH = 60
export const MAX_EXTRA_VALUE_LENGTH = 500
const MAX_URL_LENGTH = 2_048
const MAX_TITLE_LENGTH = 300

const PUBLIC_ID = /^[A-Za-z0-9]{8,16}$/

export function publicIdSchema(what = 'project') {
  const invalid = `That ${what} is not valid.`

  return z.string({ error: invalid }).regex(PUBLIC_ID, invalid)
}

const projectNameSchema = z
  .string({ error: 'Give the project a name.' })
  .trim()
  .min(1, 'Give the project a name.')
  .max(MAX_PROJECT_NAME_LENGTH, 'That project name is too long.')

const projectCitySchema = z
  .object(
    {
      name: z.string().max(100),
      region: z.string().max(100),
    },
    { error: 'That city is not valid.' },
  )
  .nullish()
  .transform((city) => city ?? null)

// Missing text reads as "", so older clients can send less.
function projectTextSchema(field: (typeof PROJECT_TEXT_FIELDS)[number]) {
  const label = field.label.toLowerCase()

  return z
    .string({ error: `That ${label} is not valid.` })
    .trim()
    .max(field.maxLength, `That ${label} is too long.`)
    .nullish()
    .transform((text) => text ?? '')
}

// SAFETY: PROJECT_TEXT_FIELDS is typed by ProjectTextKey and lists each key
// once; a key it left out would still read as "" from EMPTY_PROJECT_DETAILS.
const projectTextSchemas = Object.fromEntries(
  PROJECT_TEXT_FIELDS.map((field) => [field.key, projectTextSchema(field)]),
) as Record<ProjectTextKey, ReturnType<typeof projectTextSchema>>

const costError = 'Enter the estimated cost in whole dollars.'

const projectDetailsSchema = z
  .object(
    {
      ...projectTextSchemas,
      estimatedCost: z
        .number({ error: costError })
        .int(costError)
        .min(0, costError)
        .max(MAX_ESTIMATED_COST, costError)
        .nullish()
        .transform((cost) => cost ?? null),
      applicantIsOwner: z.boolean().catch(false),
    },
    { error: 'Those project details are not valid.' },
  )
  .nullish()
  .transform(
    (details): ProjectDetails => ({ ...EMPTY_PROJECT_DETAILS, ...details }),
  )

// A row with neither a label nor a value is dropped.
const extraFieldSchema = z
  .object({
    label: z.string().trim().catch(''),
    value: z.string().trim().catch(''),
  })
  .catch({ label: '', value: '' })
  .superRefine((field, context) => {
    if (!field.label && field.value) {
      context.addIssue({
        code: 'custom',
        message: 'Give each extra field a label.',
      })
    } else if (
      field.label.length > MAX_EXTRA_LABEL_LENGTH ||
      field.value.length > MAX_EXTRA_VALUE_LENGTH
    ) {
      context.addIssue({
        code: 'custom',
        message: `The extra field “${field.label.slice(0, 40)}” is too long.`,
      })
    }
  })

const tooManyExtraFields = `A project can have up to ${MAX_EXTRA_FIELDS} extra fields.`

const extraFieldsSchema = z
  .array(extraFieldSchema, { error: tooManyExtraFields })
  .max(MAX_EXTRA_FIELDS, tooManyExtraFields)
  .nullish()
  .transform((fields): Array<ExtraField> =>
    (fields ?? []).filter((field) => field.label || field.value),
  )

export const projectInputSchema = z.object({
  name: projectNameSchema,
  city: projectCitySchema,
  details: projectDetailsSchema,
  extraFields: extraFieldsSchema,
})

const invalidPdfLink = 'That PDF link is not valid.'

export const projectSourceUrlSchema = z
  .string({ error: invalidPdfLink })
  .max(MAX_URL_LENGTH, invalidPdfLink)
  .regex(/^https?:\/\//, invalidPdfLink)

export const projectItemSchema = z.object({
  sourceUrl: projectSourceUrlSchema,
  title: z
    .string()
    .trim()
    .catch('')
    .transform((title) => (title || 'PDF form').slice(0, MAX_TITLE_LENGTH)),
  searchId: publicIdSchema('search').optional(),
})

// "123 Main St, Unit 4, St Louis Park, Minnesota 55416", leaving out what's
// missing. Empty when the project has no address or city.
export function formatProjectAddress(
  project: Pick<Project, 'city' | 'details'>,
) {
  const { streetAddress, unit, zipCode } = project.details

  const place = [
    project.city ? `${project.city.name}, ${project.city.region}` : '',
    zipCode,
  ]
    .filter(Boolean)
    .join(' ')

  return [streetAddress, unit && `Unit ${unit}`, place]
    .filter(Boolean)
    .join(', ')
}

// "$45,000".
export function formatCost(dollars: number) {
  return `$${dollars.toLocaleString('en-US')}`
}
