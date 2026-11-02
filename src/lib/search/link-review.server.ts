import {
  buildLinkReviewRequest,
  confidentMatches,
  readLinkReviews,
  rejectionReasons,
} from '#/lib/search/link-review'
import type { LinkReview } from '#/lib/search/link-review'
import type { PermitType } from '#/lib/search/permit-types'
import { createTypeSafeClient } from '#/lib/search/typesafe.server'
import type { PermitSearchInput, PermitSearchResult } from '#/lib/search/types'
import { UserError } from '#/lib/errors'

// Keeps each request well under Jev's 64k-token per-request context limit.
const LINKS_PER_REQUEST = 25

export interface ReviewedLink {
  link: PermitSearchResult
  review: LinkReview
  confidentMatches: number
  // Empty when Jev kept the link.
  rejectionReasons: Array<string>
}

export async function reviewPermitLinks(
  input: PermitSearchInput,
  links: Array<PermitSearchResult>,
  permitTypes: Array<PermitType>,
): Promise<Array<ReviewedLink>> {
  if (links.length === 0) {
    return []
  }

  const client = createTypeSafeClient()
  const batches: Array<Array<PermitSearchResult>> = []
  for (let start = 0; start < links.length; start += LINKS_PER_REQUEST) {
    batches.push(links.slice(start, start + LINKS_PER_REQUEST))
  }

  try {
    const reviewed = await Promise.all(
      batches.map(async (batch) => {
        const { answers } = await client.systemOne(
          buildLinkReviewRequest(input, batch, permitTypes),
        )
        return readLinkReviews(batch, answers, permitTypes).map(
          (review, index) => ({
            link: batch[index],
            review,
            confidentMatches: confidentMatches(review),
            rejectionReasons: rejectionReasons(review),
          }),
        )
      }),
    )
    const results = reviewed.flat()

    for (const { link, review, rejectionReasons: reasons } of results) {
      console.log(
        JSON.stringify({
          message: reasons.length > 0 ? 'jev dropped link' : 'jev kept link',
          url: link.url,
          title: link.title,
          ...(reasons.length > 0 ? { reasons } : {}),
          scores: review,
        }),
      )
    }
    console.log(
      JSON.stringify({
        message: 'jev link review completed',
        reviewed: results.length,
        kept: results.filter(({ rejectionReasons: reasons }) => !reasons.length)
          .length,
      }),
    )

    return results
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'permit link review failed',
        links: links.length,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    throw new UserError('Permit search is temporarily unavailable.')
  }
}
