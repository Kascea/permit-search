import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { errorMessage } from '#/lib/errors'
import { OnlineApplications } from '#/components/OnlineApplications'
import { ResultsPage } from '#/components/ResultsPage'
import { startSearch } from '#/lib/search/permit-search'
import type { OnlineApplicationsPreview } from '#/lib/search/types'
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
// development doesn't start the same search twice. The online applications
// arrive first, in the same response, before the search is saved.
const pendingSearches = new Map<
  string,
  {
    online: Promise<OnlineApplicationsPreview | null>
    saved: Promise<{ publicId: string; wasReused: boolean }>
  }
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
  const [online, setOnline] = useState<OnlineApplicationsPreview | null>(null)
  const hasSearch = Boolean(city && region && permit)

  useEffect(() => {
    if (!hasSearch) {
      return
    }

    let cancelled = false
    const key = JSON.stringify([city, region, permit, fresh])
    let request = pendingSearches.get(key)

    if (!request) {
      const started = startSearch({
        data: {
          city: { name: city, region, country: 'United States' },
          permit,
          fresh,
        },
      })

      request = {
        online: started.then((search) => search.online),
        saved: started
          .then((search) => search.saved)
          .finally(() => pendingSearches.delete(key)),
      }
      pendingSearches.set(key, request)
    }

    setError('')
    setOnline(null)
    // A failure here is shown by the saved search below.
    request.online.then(
      (preview) => {
        if (!cancelled) setOnline(preview)
      },
      () => {},
    )
    request.saved
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
            errorMessage(cause, 'Permit search is temporarily unavailable.'),
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
      ) : online ? (
        <>
          <OnlineApplications response={online} city={{ name: city, region }} />
          <div
            className="mt-8 flex items-center gap-3 border-t border-ink/20 py-6 text-sm text-ink/70"
            role="status"
          >
            <span className="size-4 spinner" />
            Searching for forms and pages…
          </div>
        </>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-4 py-24 text-sm text-ink/70"
          role="status"
        >
          <span className="size-6 spinner" />
          Searching official sources…
        </div>
      )}
    </ResultsPage>
  )
}
