import { choice, noul } from '@typesafe-ai/sdk'
import type { ChoiceQuestion, NoulQuestion } from '@typesafe-ai/sdk'

import type {
  Candidate,
  ContactCandidates,
  PageLink,
} from '#/lib/contacts/extract'
import type { OfficeContact, OfficeType } from '#/lib/contacts/types'

// A page's contact details are used only when Jev answers yes to both page
// judgments with at least this probability; each field needs it too.
export const CONTACT_YES_THRESHOLD = 0.7

type CandidateField =
  'officeName' | 'phone' | 'email' | 'streetAddress' | 'hours'

// The lists of candidate values, leaving out the title and links.
type CandidateList = {
  [Key in keyof ContactCandidates]: ContactCandidates[Key] extends Array<Candidate>
    ? Key
    : never
}[keyof ContactCandidates]

const CANDIDATE_FIELDS: Record<
  CandidateField,
  { candidates: CandidateList; label: string }
> = {
  officeName: { candidates: 'officeNames', label: 'name' },
  phone: { candidates: 'phones', label: 'phone number' },
  email: { candidates: 'emails', label: 'email address' },
  streetAddress: { candidates: 'addresses', label: 'street address' },
  hours: { candidates: 'hours', label: 'office hours' },
}

const OFFICE_TYPES: Record<OfficeType, string> = {
  building: 'Building permits and inspections',
  zoning: 'Planning and zoning',
  engineering: 'Engineering or public works, including right-of-way permits',
  general:
    'City hall or a general counter that handles several kinds of permits',
}

function isOfficeType(value: string): value is OfficeType {
  return Object.hasOwn(OFFICE_TYPES, value)
}

export interface PageContactReview {
  rightJurisdiction: number
  listsPermitOffice: number
  // Null when the page's contact details aren't usable.
  office: OfficeContact | null
  portalUrl: string | null
}

export function buildContactReviewRequest(
  city: string,
  pageUrl: string,
  candidates: ContactCandidates,
) {
  const questions: Record<string, NoulQuestion | ChoiceQuestion> = {}

  questions.rightJurisdiction = noul(
    'Is `page` published by a government that issues permits for the city in `city`?',
    {
      true: 'The page is on a website run by that city, or by the county or state government that covers it.',
      false:
        "The page is from another city's government, a permit-service company, a contractor, or a directory site.",
    },
  )
  questions.listsPermitOffice = noul(
    'Does `page` give contact details for an office that handles building permits, inspections, or zoning?',
    {
      true: 'The page shows a phone number, email, or address for a building, inspections, permits, planning, or zoning office.',
      false:
        "The page has no contact details, or only ones for other offices such as police, parks, or the mayor's office.",
    },
  )
  questions.officeType = choice(
    'Which office are the contact details on `page` for?',
    OFFICE_TYPES,
  )

  for (const [field, { candidates: key, label }] of Object.entries(
    CANDIDATE_FIELDS,
  )) {
    const options = candidates[key]

    if (options.length === 0) {
      continue
    }

    questions[field] = choice(
      `Which of these is the ${label} of the permit, building, or zoning office on \`page\`?`,
      Object.fromEntries(options.map(({ value, context }) => [value, context])),
    )
    // A Choice always picks something; this says whether anything fits.
    questions[`${field}Fits`] = noul({
      question: `Is one of these the ${label} of the permit, building, or zoning office on \`page\`?`,
      candidates: options.map(({ value, context }) => ({ value, context })),
    })
  }

  if (candidates.portalLinks.length > 0) {
    questions.portal = choice(
      'Which of these links is where residents apply for permits online?',
      Object.fromEntries(
        candidates.portalLinks.map(({ url, text }) => [url, text || url]),
      ),
    )
    questions.portalFits = noul(
      {
        question:
          'Is one of these links the website where residents apply for permits online?',
        links: candidates.portalLinks.map(({ url, text }: PageLink) => ({
          url,
          text,
        })),
      },
      {
        true: 'One link opens an online permit application system, such as ePermits or Citizen Access.',
        false:
          'The links are guides, PDFs, or pages about one permit, not an online application system.',
      },
    )
  }

  return {
    state: { city, page: { title: candidates.title, url: pageUrl } },
    questions,
  }
}

type Answer =
  { noul: number } | { choice: string; probabilities: Record<string, number> }

export function readContactReview(
  pageUrl: string,
  answers: Record<string, Answer | undefined>,
): PageContactReview {
  const nouls = (key: string) => {
    const answer = answers[key]

    return answer && 'noul' in answer ? answer.noul : 0
  }

  const picked = (key: string) => {
    const answer = answers[key]

    return answer &&
      'choice' in answer &&
      nouls(`${key}Fits`) >= CONTACT_YES_THRESHOLD
      ? answer.choice
      : null
  }

  const rightJurisdiction = nouls('rightJurisdiction')
  const listsPermitOffice = nouls('listsPermitOffice')
  const isOfficialPage = rightJurisdiction >= CONTACT_YES_THRESHOLD
  const officeTypeAnswer = answers.officeType

  const office: OfficeContact | null =
    isOfficialPage &&
    listsPermitOffice >= CONTACT_YES_THRESHOLD &&
    officeTypeAnswer &&
    'choice' in officeTypeAnswer &&
    isOfficeType(officeTypeAnswer.choice)
      ? {
          officeType: officeTypeAnswer.choice,
          name: picked('officeName'),
          phone: picked('phone'),
          email: picked('email'),
          streetAddress: picked('streetAddress'),
          hours: picked('hours'),
          sourceUrl: pageUrl,
        }
      : null

  return {
    rightJurisdiction,
    listsPermitOffice,
    office:
      office && (office.phone || office.email || office.streetAddress)
        ? office
        : null,
    portalUrl: isOfficialPage ? picked('portal') : null,
  }
}
