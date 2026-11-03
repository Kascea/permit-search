import { noul } from '@typesafe-ai/sdk'
import type { NoulQuestion } from '@typesafe-ai/sdk'

import type { PermitType } from '#/lib/search/permit-types'
import type { PermitSearchInput, PermitSearchResult } from '#/lib/search/types'

// A Noul at or above YES_THRESHOLD counts as yes; at or below NO_THRESHOLD as no.
// Anything between is unsettled: the link is kept but ranks below confident matches.
export const YES_THRESHOLD = 0.7
export const NO_THRESHOLD = 0.3

export type LinkJudgment =
  | 'rightJurisdiction'
  | 'rightPermit'
  | 'neededPermit'
  | 'actionableDocument'
  | 'generalPermitsPage'

export type LinkReview = Record<LinkJudgment, number>

function linkQuestions(
  link: PermitSearchResult,
  askNeededPermit: boolean,
): Map<LinkJudgment, NoulQuestion> {
  const subject = {
    title: link.title,
    url: link.url,
    description: link.description,
  }

  const questions = new Map<LinkJudgment, NoulQuestion>()

  questions.set(
    'rightJurisdiction',
    noul(
      {
        question:
          'Is `link` published by a government that issues permits for the city in `search.city`?',
        link: subject,
      },
      {
        true: 'The link is on a website run by that city, or by the county or state government that covers it.',
        false:
          "The link is from another city's government, a permit-service company, a contractor, a news site, or a forum.",
      },
    ),
  )

  questions.set(
    'rightPermit',
    noul(
      {
        question:
          'Is `link` mainly about the permit described in `search.permit`?',
        link: subject,
      },
      {
        true: 'The link is dedicated to that permit, such as its application, handout, or requirements page.',
        false:
          'The link covers a different permit, or names this permit only as one row in a longer list such as a fee schedule, city code, or index of permits.',
      },
    ),
  )

  if (askNeededPermit) {
    questions.set(
      'neededPermit',
      noul(
        {
          question:
            'Is `link` mainly about one of the permits in `search.permitsNeeded`?',
          link: subject,
        },
        {
          true: 'The link is dedicated to one of those permits, such as its application, handout, or requirements page.',
          false:
            'The link covers a different kind of permit, or names these permits only as rows in a longer list such as a fee schedule, city code, or index of permits.',
        },
      ),
    )
  }

  questions.set(
    'actionableDocument',
    noul(
      {
        question:
          'Is `link` an application form, a checklist, or a list of submittal requirements?',
        link: subject,
      },
      {
        true: 'Opening the link gives the user a form to fill out, or the documents and steps needed to apply.',
        false:
          'The link is a general department landing page, a news article, a meeting agenda, or a staff directory.',
      },
    ),
  )

  // Read only when no specific link survives, to fall back to the city's
  // general permit pages.
  questions.set(
    'generalPermitsPage',
    noul(
      {
        question:
          'Is `link` a general permits page or an online permit application portal?',
        link: subject,
      },
      {
        true: "The link is a permits landing page, a building department's permits page, or the website where residents apply for permits online.",
        false:
          'The link is about one specific permit, or about something other than permits, such as police, parking, or events.',
      },
    ),
  )

  return questions
}

// The search as the review questions see it. A type, not an interface, so it
// fits the SDK's state type.
type ReviewedSearch = {
  city: string
  permit: string
  permitsNeeded?: Array<string>
}

export function buildLinkReviewRequest(
  input: PermitSearchInput,
  links: Array<PermitSearchResult>,
  permitTypes: Array<PermitType>,
) {
  const askNeededPermit = permitTypes.length > 0
  const questions: Record<string, NoulQuestion> = {}

  links.forEach((link, index) => {
    for (const [judgment, question] of linkQuestions(link, askNeededPermit)) {
      questions[questionKey(index, judgment)] = question
    }
  })

  const search: ReviewedSearch = {
    city: `${input.city.name}, ${input.city.region}`,
    permit: input.permit,
  }

  if (askNeededPermit) {
    search.permitsNeeded = permitTypes.map(({ name }) => name)
  }

  return { state: { search }, questions }
}

export function readLinkReviews(
  links: Array<PermitSearchResult>,
  answers: Record<string, { noul: number } | undefined>,
  permitTypes: Array<PermitType>,
): Array<LinkReview> {
  return links.map((link, index) => {
    // neededPermit stays 0 when it isn't asked.
    const review: LinkReview = {
      rightJurisdiction: 0,
      rightPermit: 0,
      neededPermit: 0,
      actionableDocument: 0,
      generalPermitsPage: 0,
    }

    for (const judgment of linkQuestions(link, permitTypes.length > 0).keys()) {
      const answer = answers[questionKey(index, judgment)]

      if (answer === undefined) {
        throw new Error(
          `Link review is missing answer ${questionKey(index, judgment)}.`,
        )
      }

      review[judgment] = answer.noul
    }

    return review
  })
}

// How well the link matches what the user is looking for: the project itself,
// or one of the permits the project needs.
function permitMatch(review: LinkReview) {
  return Math.max(review.rightPermit, review.neededPermit)
}

// Empty when the link is kept.
export function rejectionReasons(review: LinkReview) {
  const reasons: Array<string> = []

  if (review.rightJurisdiction <= NO_THRESHOLD) {
    reasons.push(
      `not from this city's government (${review.rightJurisdiction.toFixed(2)})`,
    )
  }

  if (permitMatch(review) <= NO_THRESHOLD) {
    reasons.push(
      `not about this project or a permit it needs (${permitMatch(review).toFixed(2)})`,
    )
  }

  return reasons
}

// Primary sort key: how many of jurisdiction, permit match, and actionable
// document Jev answered with a confident yes (0–3).
export function confidentMatches(review: LinkReview) {
  return [
    review.rightJurisdiction,
    permitMatch(review),
    review.actionableDocument,
  ].filter((score) => score >= YES_THRESHOLD).length
}

export function isGeneralPermitsPage(review: LinkReview) {
  return (
    review.rightJurisdiction >= YES_THRESHOLD &&
    review.generalPermitsPage >= YES_THRESHOLD
  )
}

function questionKey(index: number, judgment: LinkJudgment) {
  return `link${index}_${judgment}`
}
