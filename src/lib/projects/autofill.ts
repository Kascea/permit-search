import { roleFillKey } from '#/lib/forms/roles'
import type { FieldRole } from '#/lib/forms/roles'
import { STATE_NAMES } from '#/lib/location/states'
import { PROJECT_TEXT_FIELDS } from '#/lib/projects/types'
import type { Project, ProjectTextKey } from '#/lib/projects/types'

// Fills a PDF's empty text fields from a project by reading each field's
// name, such as "OwnerPhone" or "topmostSubform[0].Page1[0].Site_Address[0]".
// It guesses only when the name is clear; a field it can't place is left for
// the user, who can copy the value from the project instead.

// What a project can put in a field: its text details, plus the city, state,
// cost, and "City, ST 55416" for forms that ask for them in one box. Also
// today's date, for the date beside a signature; only a field Jev gave that
// role is filled with it, never one matched by name.
export type FillKey =
  | ProjectTextKey
  | 'estimatedCost'
  | 'city'
  | 'state'
  | 'cityStateZip'
  | 'todaysDate'

const STATE_ABBREVIATIONS = new Map(
  Object.entries(STATE_NAMES).map(([abbreviation, name]) => [
    name,
    abbreviation,
  ]),
)

// "OwnerPhone_1" → ["owner", "phone", "1"].
function wordsOf(text: string) {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

const PARTIES = ['owner', 'applicant', 'contractor'] as const

type Party = (typeof PARTIES)[number]

const PARTY_WORDS: Record<Party, Array<string>> = {
  owner: ['owner', 'owners', 'homeowner', 'landowner'],
  applicant: ['applicant', 'applicants', 'requester', 'requestor'],
  contractor: [
    'contractor',
    'contractors',
    'builder',
    'company',
    'business',
    'firm',
  ],
}

// Fields that name a party but want something a project doesn't hold.
const SKIP_WORDS = [
  'signature',
  'sign',
  'signed',
  'date',
  'initial',
  'initials',
  'title',
  'fax',
  'first',
  'last',
  'middle',
]

// The party the field's name mentions first, if any.
function partyOf(words: Array<string>) {
  let found: { party: Party; index: number } | undefined

  for (const party of PARTIES) {
    const index = words.findIndex((word) => PARTY_WORDS[party].includes(word))

    if (index >= 0 && (!found || index < found.index)) {
      found = { party, index }
    }
  }

  return found?.party
}

export function matchProjectField(fieldName: string): FillKey | null {
  const words = wordsOf(fieldName)

  const has = (...options: Array<string>) =>
    options.some((option) => words.includes(option))

  if (has(...SKIP_WORDS)) return null

  const party = partyOf(words)
  const isMailing = has('mailing', 'mail')

  if (has('email') || (has('e') && has('mail'))) {
    return party === 'owner'
      ? 'ownerEmail'
      : party === 'contractor'
        ? 'contractorEmail'
        : 'applicantEmail'
  }

  if (has('phone', 'telephone', 'tel', 'cell', 'mobile', 'ph')) {
    return party === 'owner'
      ? 'ownerPhone'
      : party === 'contractor'
        ? 'contractorPhone'
        : 'applicantPhone'
  }

  if (has('license', 'licence', 'lic')) {
    return party === 'owner' ? null : 'contractorLicense'
  }

  if (has('parcel', 'pin', 'apn', 'pid') || (has('tax') && has('id'))) {
    return 'parcelNumber'
  }

  if (has('valuation', 'value', 'cost')) return 'estimatedCost'

  if (has('description', 'describe', 'scope')) return 'workDescription'

  // City, state, ZIP and unit mean the property's unless a party or mailing
  // address is named.
  const isProperty = !party && !isMailing

  if (has('city') && has('state') && has('zip')) {
    return isProperty ? 'cityStateZip' : null
  }

  if (has('zip', 'zipcode', 'postal')) return isProperty ? 'zipCode' : null

  if (has('state')) return isProperty ? 'state' : null

  if (has('city', 'town')) return isProperty ? 'city' : null

  if (has('unit', 'apt', 'suite', 'ste')) return isProperty ? 'unit' : null

  if (has('address', 'addr', 'street', 'location')) {
    if (party === 'owner') return 'ownerMailingAddress'

    return party || isMailing ? null : 'streetAddress'
  }

  if (has('name') || (party && words.length <= 2)) {
    return party === 'owner'
      ? 'ownerName'
      : party === 'contractor'
        ? 'contractorCompany'
        : 'applicantName'
  }

  if (has('work') && !party) return 'workDescription'

  return null
}

// The value for each fill key, using the owner's details for the applicant
// when they're the same person.
export function fillValues(project: Project): Partial<Record<FillKey, string>> {
  const { details, city } = project

  const values: Partial<Record<FillKey, string>> = Object.fromEntries(
    PROJECT_TEXT_FIELDS.map((field) => [field.key, details[field.key]]),
  )

  if (details.applicantIsOwner) {
    values.applicantName = details.ownerName
    values.applicantPhone = details.ownerPhone
    values.applicantEmail = details.ownerEmail
  }

  // The owner's mailing address defaults to the property's.
  if (!details.ownerMailingAddress && details.streetAddress) {
    values.ownerMailingAddress = [
      details.streetAddress,
      details.unit && `Unit ${details.unit}`,
    ]
      .filter(Boolean)
      .join(', ')
  }

  values.estimatedCost =
    details.estimatedCost === null ? '' : String(details.estimatedCost)
  values.city = city?.name ?? ''
  values.state = city?.region ?? ''
  values.cityStateZip = city
    ? `${city.name}, ${STATE_ABBREVIATIONS.get(city.region) ?? city.region} ${details.zipCode}`.trim()
    : ''

  const today = new Date()

  values.todaysDate = [
    today.getMonth() + 1,
    today.getDate(),
    today.getFullYear(),
  ]
    .map((part) => String(part).padStart(2, '0'))
    .join('/')

  return values
}

// The value for an extra field whose label is all in the PDF field's name,
// such as "Lot" for "LotNumber". Longer labels win.
function matchExtraField(fieldName: string, project: Project) {
  const words = wordsOf(fieldName)

  return project.extraFields
    .filter((field) => field.value)
    .map((field) => ({ field, labelWords: wordsOf(field.label) }))
    .filter(
      ({ labelWords }) =>
        labelWords.length > 0 &&
        labelWords.every((word) => words.includes(word)),
    )
    .sort((a, b) => b.labelWords.length - a.labelWords.length)
    .at(0)?.field.value
}

// Field IDs to the value each should get. Takes the PDF's empty text fields;
// width is the field's first box in PDF points, so narrow state boxes get
// "MN" instead of "Minnesota". roles: what each field asks for, by field
// name, once the form has been read (see FormSchema); only fields without
// one are matched by name.
export function projectFills(
  fields: Array<{ id: string; name: string; width: number }>,
  project: Project,
  roles: Partial<Record<string, FieldRole>> = {},
) {
  const values = fillValues(project)
  const fills = new Map<string, string>()

  for (const field of fields) {
    const role = roles[field.name]

    // Jev's role wins, even when it fills nothing: a contractor's address
    // named only "Address_2" would otherwise get the job site's.
    const key = role
      ? (roleFillKey(role) ?? null)
      : matchProjectField(field.name)

    let value = key ? values[key] : matchExtraField(field.name, project)

    if (key === 'state' && value && field.width < 60) {
      value = STATE_ABBREVIATIONS.get(value) ?? value
    }

    if (value) fills.set(field.id, value)
  }

  return fills
}
