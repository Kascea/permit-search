import { noul } from '@typesafe-ai/sdk'
import type { NoulQuestion } from '@typesafe-ai/sdk'

import type { PermitSearchInput } from '#/lib/search/types'

// A permit type is searched for when Jev thinks the project more likely than
// not includes its work. This is lower than the link-review threshold because
// a needed permit that's missed hides every page for it, while an extra one
// only widens the search: links still have to pass the jurisdiction and
// permit-match judgments.
export const PERMIT_TYPE_THRESHOLD = 0.5

export interface PermitType {
  id: string
  name: string
  // The work that usually requires this permit, as Jev is asked about it.
  scope: string
}

// The permit types a U.S. city commonly issues for residential and small
// commercial projects. Jev picks from these rather than naming permits itself.
export const PERMIT_TYPES: Array<PermitType> = [
  {
    id: 'building',
    name: 'building permit',
    scope:
      'construction or remodeling work such as a renovation, addition, deck, new walls, or finishing a basement',
  },
  {
    id: 'plumbing',
    name: 'plumbing permit',
    scope:
      'adding, moving, or replacing plumbing fixtures, a water heater, or water or drain lines',
  },
  {
    id: 'electrical',
    name: 'electrical permit',
    scope:
      'new or changed wiring, circuits, outlets, light fixtures, or an electrical panel',
  },
  {
    id: 'mechanical',
    name: 'mechanical permit',
    scope:
      'installing or replacing a furnace, air conditioner, ductwork, exhaust fan, or gas line',
  },
  {
    id: 'demolition',
    name: 'demolition permit',
    scope: 'tearing down a building, garage, or other structure',
  },
  {
    id: 'roofing',
    name: 'roofing permit',
    scope: 'replacing or re-covering a roof',
  },
  {
    id: 'fence',
    name: 'fence permit',
    scope: 'building or replacing a fence',
  },
  {
    id: 'zoning',
    name: 'zoning permit',
    scope:
      'a land-use approval such as a variance, a conditional use, or a new accessory dwelling unit',
  },
  {
    id: 'sign',
    name: 'sign permit',
    scope: 'putting up a business or other outdoor sign',
  },
  {
    id: 'rightOfWay',
    name: 'right-of-way permit',
    scope: 'work in a public street, sidewalk, boulevard, or driveway apron',
  },
]

export function buildPermitTypeRequest(input: PermitSearchInput) {
  const questions: Record<string, NoulQuestion> = {}
  for (const permitType of PERMIT_TYPES) {
    questions[permitType.id] = noul(
      `Does the project in \`project\` include ${permitType.scope}?`,
      {
        true: `The project includes ${permitType.scope}.`,
        false: 'The project involves none of this work.',
      },
    )
  }

  return { state: { project: input.permit }, questions }
}

export function readPermitTypeScores(
  answers: Record<string, { noul: number } | undefined>,
) {
  const scores: Record<string, number> = {}
  for (const permitType of PERMIT_TYPES) {
    const answer = answers[permitType.id]
    if (typeof answer?.noul !== 'number') {
      throw new Error(`Permit type review is missing answer ${permitType.id}.`)
    }
    scores[permitType.id] = answer.noul
  }
  return scores
}

export function neededPermitTypes(scores: Record<string, number>) {
  return PERMIT_TYPES.filter(
    (permitType) => scores[permitType.id] >= PERMIT_TYPE_THRESHOLD,
  )
}
