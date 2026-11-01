import { env } from 'cloudflare:workers'
import { TypeSafeClient } from '@typesafe-ai/sdk'

import {
  buildLinkReviewRequest,
  confidentMatches,
  isRejected,
  readLinkReviews,
} from '#/lib/search/link-review'
import type { LinkReview } from '#/lib/search/link-review'
import type { PermitSearchInput, PermitSearchResult } from '#/lib/search/types'

// Keeps each request well under Jev's 64k-token per-request context limit.
const LINKS_PER_REQUEST = 25
const REVIEW_TIMEOUT_MS = 10_000

export interface ReviewedLink {
  link: PermitSearchResult
  review: LinkReview
  confidentMatches: number
}

export async function reviewPermitLinks(
  input: PermitSearchInput,
  links: Array<PermitSearchResult>,
): Promise<Array<ReviewedLink>> {
  if (links.length === 0) {
    return []
  }

  const client = new TypeSafeClient({
    apiKey: env.TYPESAFE_API_KEY.trim(),
    compression: false,
    timeout: REVIEW_TIMEOUT_MS,
  })
  const batches: Array<Array<PermitSearchResult>> = []
  for (let start = 0; start < links.length; start += LINKS_PER_REQUEST) {
    batches.push(links.slice(start, start + LINKS_PER_REQUEST))
  }

  try {
    const reviewed = await Promise.all(
      batches.map(async (batch) => {
        const { answers } = await client.systemOne(
          buildLinkReviewRequest(input, batch),
        )
        return readLinkReviews(batch, answers).map((review, index) => ({
          link: batch[index],
          review,
          confidentMatches: confidentMatches(review),
        }))
      }),
    )
    const results = reviewed.flat()

    console.log(
      JSON.stringify({
        message: 'permit link review completed',
        links: results.map(({ link, review }) => ({
          url: link.url,
          ...review,
          rejected: isRejected(review),
        })),
      }),
    )

    return results.filter(({ review }) => !isRejected(review))
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'permit link review failed',
        links: links.length,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    throw new Error('Permit search is temporarily unavailable.')
  }
}
