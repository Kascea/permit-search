import { noul } from '@typesafe-ai/sdk'
import type { NoulQuestion, TypeSafeClient } from '@typesafe-ai/sdk'

import type { PortalPermitType } from '#/lib/portals/types'

// The Jev questions that match a project to a city's online permit types,
// apart from the Worker so they can be tried in Node.

// A type is offered when Jev is fairly sure the project needs it, and it's
// close to the best match: a city lists many near neighbors ("Replace single
// fixture" beside "Replace a water heater"), and the clear best one shouldn't
// come with every loose fit. Tried on St. Louis Park and Edina's catalogs.
const MATCH_MIN_SCORE = 0.6
const MATCH_MAX_GAP = 0.25

// A project rarely needs more; more would bury the web results.
const MAX_MATCHES = 3

// Questions per Jev request, as in form ingest.
const QUESTIONS_PER_REQUEST = 40

function typeQuestion(type: PortalPermitType): NoulQuestion {
  const listing = type.category ? `${type.name} (under ${type.category})` : type.name

  return noul(
    `Would the city issue the permit "${listing}" for the project in \`project\`?`,
    {
      true: `The project's work is what "${type.name}" covers, so the applicant would choose it on the city's permit portal.`,
      false: `"${type.name}" is for different work, or for a different kind of property (such as commercial instead of residential).`,
    },
  )
}

// Takes the client so it can be tried outside the Worker.
export async function scoreTypes(
  client: TypeSafeClient,
  project: string,
  types: Array<PortalPermitType>,
) {
  const batches: Array<Array<PortalPermitType>> = []

  for (let start = 0; start < types.length; start += QUESTIONS_PER_REQUEST) {
    batches.push(types.slice(start, start + QUESTIONS_PER_REQUEST))
  }

  const scored = await Promise.all(
    batches.map(async (batch) => {
      const questions = Object.fromEntries(
        batch.map((type) => [`t${type.id}`, typeQuestion(type)]),
      )

      const { answers } = await client.systemOne({
        state: { project },
        questions,
      })

      return batch.map((type) => {
        const answer = answers[`t${type.id}`]

        return {
          type,
          score: answer && 'noul' in answer ? answer.noul : 0,
        }
      })
    }),
  )

  return scored.flat()
}

// The types to offer, best first.
export function pickMatches<Scored extends { score: number }>(
  scored: Array<Scored>,
) {
  const best = Math.max(0, ...scored.map(({ score }) => score))

  return scored
    .filter(
      ({ score }) => score >= MATCH_MIN_SCORE && score >= best - MATCH_MAX_GAP,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES)
}
