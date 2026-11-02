import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { errorMessage } from '#/lib/errors'
import { ResultsPage } from '#/components/ResultsPage'
import { startSearch } from '#/lib/search/permit-search'

interface PendingSearch {
  city: string
  region: string
  permit: string
  // Run the search even when a recent matching one is saved.
  fresh?: boolean
}

// One request per search per page session, so React running effects twice in
// development doesn't start the same search twice.
const pendingSearches = new Map<
  string,
  Promise<{ publicId: string; wasReused: boolean }>
>()

// Starts (or reuses) a search, then replaces this URL with the saved search's
// /results/<id> so it can be shared and reopened.
export const Route = createFileRoute('/results/')({
  validateSearch: (search: Record<string, unknown>): PendingSearch => ({
    city: typeof search.city === 'string' ? search.city : '',
    region: typeof search.region === 'string' ? search.region : '',
    permit: typeof search.permit === 'string' ? search.permit : '',
    ...(search.fresh === true || search.fresh === 'true'
      ? { fresh: true }
      : {}),
  }),
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
            to: '/results/$searchId',
            params: { searchId: publicId },
            replace: true,
          })
        }
      })
      .catch((searchError: unknown) => {
        if (!cancelled) {
          setError(
            errorMessage(
              searchError,
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
        <p
          className="mt-6 border border-redline bg-redline/10 px-4 py-3 text-sm font-medium text-redline"
          role="alert"
        >
          {error}
        </p>
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
