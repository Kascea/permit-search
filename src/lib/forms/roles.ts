import type { FillKey } from '#/lib/projects/autofill'

// What a form's text field asks for. Jev picks one for each field when a form
// is first read; each description is sent to it as that option's criterion.
// project: the value autofill puts in the field, and the matchesProject
// check compares with: one of the project's, or today's date.
export const FIELD_ROLES = {
  propertyAddress: {
    project: 'streetAddress',
    describe:
      'The street address where the work happens, also called the job site or site address. Not the address in an owner, applicant or contractor section.',
  },
  propertyUnit: {
    project: 'unit',
    describe:
      'The unit, suite or apartment number where the work happens. Not one in an owner, applicant or contractor section.',
  },
  propertyZip: {
    project: 'zipCode',
    describe:
      'The ZIP code where the work happens. Not one in an owner, applicant or contractor section.',
  },
  parcelNumber: {
    project: 'parcelNumber',
    describe: 'The parcel number, PIN, APN, PID or tax ID of the property',
  },
  workDescription: {
    project: 'workDescription',
    describe: 'A description of the work, project or scope of work',
  },
  estimatedCost: {
    project: 'estimatedCost',
    describe: 'The valuation, estimated cost or contract price of the work',
  },
  ownerName: {
    project: 'ownerName',
    describe: 'The property owner’s name',
  },
  ownerPhone: {
    project: 'ownerPhone',
    describe: 'The property owner’s phone number',
  },
  ownerEmail: {
    project: 'ownerEmail',
    describe: 'The property owner’s email address',
  },
  ownerMailingAddress: {
    project: 'ownerMailingAddress',
    describe:
      'The property owner’s street or mailing address, in the owner’s section of the form',
  },
  applicantName: {
    project: 'applicantName',
    describe: 'The name of the applicant, the person filing the application',
  },
  applicantPhone: {
    project: 'applicantPhone',
    describe: 'The applicant’s phone number',
  },
  applicantEmail: {
    project: 'applicantEmail',
    describe: 'The applicant’s email address',
  },
  contractorCompany: {
    project: 'contractorCompany',
    describe:
      'The name of the contractor or contracting company doing the work',
  },
  contractorLicense: {
    project: 'contractorLicense',
    describe: 'The contractor’s license number',
  },
  contractorPhone: {
    project: 'contractorPhone',
    describe: 'The contractor’s phone number',
  },
  contractorEmail: {
    project: 'contractorEmail',
    describe: 'The contractor’s email address',
  },
  signature: {
    describe: 'A signature line for the applicant or owner',
  },
  signatureDate: {
    project: 'todaysDate',
    describe: 'The date written next to a signature',
  },
  projectDate: {
    describe:
      'A date about the work, such as when it starts, ends or will be inspected',
  },
  other: {
    describe:
      'Something else, such as a city, state, measurement, the write-in blank beside an “Other” checkbox, or the address, unit or ZIP code of the applicant or contractor',
  },
} as const satisfies Record<string, { project?: FillKey; describe: string }>

export type FieldRole = keyof typeof FIELD_ROLES

export function isFieldRole(value: string): value is FieldRole {
  return Object.hasOwn(FIELD_ROLES, value)
}

// The project value a role fills, if any.
export function roleFillKey(role: FieldRole): FillKey | undefined {
  const definition = FIELD_ROLES[role]

  return 'project' in definition ? definition.project : undefined
}
