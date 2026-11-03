import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { errorMessage } from '#/lib/errors'
import { ResultsPage } from '#/components/ResultsPage'
import { startSearch } from '#/lib/search/permit-search'
import { Notice } from '#/components/Notice'

const pendingSearchSchema = z.object({
  city: z.string().catch(''),
  region: z.string().catch(''),
  permit: z.string().catch(''),
  // Run the search even when a recent matching one is saved.
  fresh: z
    .union([z.boolean(), z.literal('true').transform(() => true)])
    .optional()
    .catch(undefined),
})

// One request per search per page session, so React running effects twice in
// development doesn't start the same search twice.
const pendingSearches = new Map<
  string,
  Promise<{ publicId: string; wasReused: boolean }>
>()

// Starts (or reuses) a search, then replaces this URL with the saved search's
// /search/results/<id> so it can be shared and reopened.
export const Route = createFileRoute('/search/results/')({
  validateSearch: pendingSearchSchema,
  component: PendingResults,
})

function PendingResults() {
  const navigate = useNavigate()
  const { city, region, permit, fresh = false } = Route.useSearch()
  const [error, setError] = useState('')
  const hasSearch = Boolean(city && region && permit)

  useEffect(() => {
    if (!hasSearch) {
      return
    }

    let cancelled = false
    const key = JSON.stringify([city, region, permit, fresh])
    let request = pendingSearches.get(key)

    if (!request) {
      request = startSearch({
        data: {
          city: { name: city, region, country: 'United States' },
          permit,
          fresh,
        },
      }).finally(() => pendingSearches.delete(key))
      pendingSearches.set(key, request)
    }

    setError('')
    request
      .then(({ publicId }) => {
        if (!cancelled) {
          void navigate({
            to: '/search/results/$searchId',
            params: { searchId: publicId },
            replace: true,
          })
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            errorMessage(
              cause,
              'Permit search is temporarily unavailable.',
            ),
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [hasSearch, city, region, permit, fresh, navigate])

  if (!hasSearch) {
    return <ResultsPage />
  }

  return (
    <ResultsPage search={{ city: { name: city, region }, permit }}>
      {error ? (
        <Notice tone="error" className="mt-6">
          {error}
        </Notice>
      ) : (
        <div
          className="mt-6 flex items-center gap-3 border-t border-ink pt-5 text-sm text-ink/70"
          role="status"
        >
          <span className="size-4 spinner" />
          Searching official sources…
        </div>
      )}
    </ResultsPage>
  )
}
