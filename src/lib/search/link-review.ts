import { noul } from '@typesafe-ai/sdk'
import type { NoulQuestion } from '@typesafe-ai/sdk'

import type { PermitSearchInput, PermitSearchResult } from '#/lib/search/types'

// A Noul at or above YES_THRESHOLD counts as yes; at or below NO_THRESHOLD as no.
// Anything between is unsettled: the link is kept but ranks below confident matches.
export const YES_THRESHOLD = 0.7
export const NO_THRESHOLD = 0.3

export type LinkJudgment =
  'rightJurisdiction' | 'rightPermit' | 'actionableDocument'

export type LinkReview = Record<LinkJudgment, number>

const LINK_JUDGMENTS: Array<LinkJudgment> = [
  'rightJurisdiction',
  'rightPermit',
  'actionableDocument',
]

// Judgments that remove a link when Jev answers a confident no.
const REQUIRED_JUDGMENTS: Array<LinkJudgment> = [
  'rightJurisdiction',
  'rightPermit',
]

function linkQuestions(
  link: PermitSearchResult,
): Record<LinkJudgment, NoulQuestion> {
  const subject = {
    title: link.title,
    url: link.url,
    description: link.description,
  }

  return {
    rightJurisdiction: noul(
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
    rightPermit: noul(
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
    actionableDocument: noul(
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
  }
}

export function buildLinkReviewRequest(
  input: PermitSearchInput,
  links: Array<PermitSearchResult>,
) {
  const questions: Record<string, NoulQuestion> = {}
  links.forEach((link, index) => {
    for (const [judgment, question] of Object.entries(linkQuestions(link))) {
      questions[questionKey(index, judgment as LinkJudgment)] = question
    }
  })

  return {
    state: {
      search: {
        city: `${input.city.name}, ${input.city.region}`,
        permit: input.permit,
      },
    },
    questions,
  }
}

export function readLinkReviews(
  links: Array<PermitSearchResult>,
  answers: Record<string, { noul: number } | undefined>,
): Array<LinkReview> {
  return links.map((_, index) => {
    const review = {} as LinkReview
    for (const judgment of LINK_JUDGMENTS) {
      const answer = answers[questionKey(index, judgment)]
      if (typeof answer?.noul !== 'number') {
        throw new Error(
          `Link review is missing answer ${questionKey(index, judgment)}.`,
        )
      }
      review[judgment] = answer.noul
    }
    return review
  })
}

export function isRejected(review: LinkReview) {
  return REQUIRED_JUDGMENTS.some((judgment) => review[judgment] <= NO_THRESHOLD)
}

// Primary sort key: how many judgments Jev answered with a confident yes (0–3).
export function confidentMatches(review: LinkReview) {
  return LINK_JUDGMENTS.filter((judgment) => review[judgment] >= YES_THRESHOLD)
    .length
}

function questionKey(index: number, judgment: LinkJudgment) {
  return `link${index}_${judgment}`
}
