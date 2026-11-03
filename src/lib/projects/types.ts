import { UserError } from '#/lib/errors'
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

export function validatePublicId(value: unknown, what = 'project') {
  if (typeof value !== 'string' || !PUBLIC_ID.test(value)) {
    throw new UserError(`That ${what} is not valid.`)
  }
  return value
}

export function validateProjectName(value: unknown) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) throw new UserError('Give the project a name.')
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw new UserError('That project name is too long.')
  }
  return name
}

export function validateProjectCity(value: unknown): Project['city'] {
  if (value === null || value === undefined) return null
  const city = value as Record<string, unknown>
  if (
    typeof city.name !== 'string' ||
    typeof city.region !== 'string' ||
    city.name.length > 100 ||
    city.region.length > 100
  ) {
    throw new UserError('That city is not valid.')
  }
  return { name: city.name, region: city.region }
}

// Missing fields are treated as empty, so older clients can send less.
export function validateProjectDetails(value: unknown): ProjectDetails {
  const input = (value ?? {}) as Record<string, unknown>
  const details: ProjectDetails = { ...EMPTY_PROJECT_DETAILS }

  for (const field of PROJECT_TEXT_FIELDS) {
    const text = input[field.key]
    if (text === undefined || text === null) continue
    if (typeof text !== 'string') {
      throw new UserError(`That ${field.label.toLowerCase()} is not valid.`)
    }
    const trimmed = text.trim()
    if (trimmed.length > field.maxLength) {
      throw new UserError(`That ${field.label.toLowerCase()} is too long.`)
    }
    details[field.key] = trimmed
  }

  const cost = input.estimatedCost
  if (cost !== undefined && cost !== null) {
    if (
      typeof cost !== 'number' ||
      !Number.isInteger(cost) ||
      cost < 0 ||
      cost > MAX_ESTIMATED_COST
    ) {
      throw new UserError('Enter the estimated cost in whole dollars.')
    }
    details.estimatedCost = cost
  }
  details.applicantIsOwner = input.applicantIsOwner === true
  return details
}

// Drops rows with no label and no value.
export function validateExtraFields(value: unknown): Array<ExtraField> {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > MAX_EXTRA_FIELDS) {
    throw new UserError(
      `A project can have up to ${MAX_EXTRA_FIELDS} extra fields.`,
    )
  }
  return value.flatMap((item: unknown) => {
    const field = (item ?? {}) as Record<string, unknown>
    const label = typeof field.label === 'string' ? field.label.trim() : ''
    const text = typeof field.value === 'string' ? field.value.trim() : ''
    if (!label && !text) return []
    if (!label) throw new UserError('Give each extra field a label.')
    if (
      label.length > MAX_EXTRA_LABEL_LENGTH ||
      text.length > MAX_EXTRA_VALUE_LENGTH
    ) {
      throw new UserError(
        `The extra field “${label.slice(0, 40)}” is too long.`,
      )
    }
    return [{ label, value: text }]
  })
}

export function validateProjectInput(value: unknown): ProjectInput {
  const input = (value ?? {}) as Record<string, unknown>
  return {
    name: validateProjectName(input.name),
    city: validateProjectCity(input.city),
    details: validateProjectDetails(input.details),
    extraFields: validateExtraFields(input.extraFields),
  }
}

export function validateProjectItem(value: unknown): ProjectItem {
  const item = (value ?? {}) as Record<string, unknown>
  if (
    typeof item.sourceUrl !== 'string' ||
    item.sourceUrl.length > MAX_URL_LENGTH ||
    !/^https?:\/\//.test(item.sourceUrl)
  ) {
    throw new UserError('That PDF link is not valid.')
  }
  const title = typeof item.title === 'string' ? item.title.trim() : ''
  return {
    sourceUrl: item.sourceUrl,
    title: (title || 'PDF form').slice(0, MAX_TITLE_LENGTH),
    ...(item.searchId === undefined
      ? {}
      : { searchId: validatePublicId(item.searchId, 'search') }),
  }
}

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
