import {
  buildPermitTypeRequest,
  neededPermitTypes,
  readPermitTypeScores,
} from '#/lib/search/permit-types'
import type { PermitType } from '#/lib/search/permit-types'
import { createTypeSafeClient } from '#/lib/search/typesafe.server'
import type { PermitSearchInput } from '#/lib/search/types'
import { UserError } from '#/lib/errors'

export async function identifyPermitTypes(
  input: PermitSearchInput,
): Promise<Array<PermitType>> {
  try {
    const { answers } = await createTypeSafeClient().systemOne(
      buildPermitTypeRequest(input),
    )
    const scores = readPermitTypeScores(answers)
    const permitTypes = neededPermitTypes(scores)

    console.log(
      JSON.stringify({
        message: 'jev identified permit types',
        project: input.permit,
        needed: permitTypes.map(({ name }) => name),
        scores,
      }),
    )

    return permitTypes
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'permit type identification failed',
        project: input.permit,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    throw new UserError('Permit search is temporarily unavailable.')
  }
}
