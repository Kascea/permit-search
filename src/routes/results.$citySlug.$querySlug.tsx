import {
  Link,
  createFileRoute,
  notFound,
  useLocation,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Notice } from '#/components/Notice'
import { OnlineApplications } from '#/components/OnlineApplications'
import { ResultsPage } from '#/components/ResultsPage'
import { SearchResultsList } from '#/components/SearchResultsList'
import { SignInButton } from '#/components/SignInDialog'
import { useResumeAfterSignIn } from '#/lib/auth/resume'
import { useAuth } from '#/lib/auth/use-auth'
import { errorMessage } from '#/lib/errors'
import { searchLabel } from '#/lib/navigation/origin'
import {
  SEARCH_REFRESH_HOURS,
  isSearchSlug,
} from '#/lib/saved-searches/search-key'
import { searchPageTarget } from '#/lib/search/pending-search'
import type { PendingSearch } from '#/lib/search/pending-search'
import { getSavedSearch, startSearch } from '#/lib/search/permit-search'
import type { OnlineApplicationsPreview } from '#/lib/search/types'
import { SITE_URL } from '#/lib/site'
import type { SavedSearch } from '#/lib/saved-searches/saved-searches.server'

// Results this young were just run for this visitor (or someone moments
// before), so they're labeled new rather than saved.
const NEW_FOR_MINUTES = 10

// One request per search per page session, so React running effects twice in
// development doesn't start the same search twice. The online applications
// arrive first, in the same response, before the search is saved.
const runningSearches = new Map<
  string,
  {
    online: Promise<OnlineApplicationsPreview | null>
    saved: Promise<{ slug: string }>
  }
>()

// A search's page, such as /results/edina-mn/fence. Shows its newest results,
// however old; "Search again" runs it fresh, at most once a day. Opened with a
// pending search, it runs that first; see PendingSearch.
export const Route = createFileRoute('/results/$citySlug/$querySlug')({
  // A malformed link is "not found"; a failed lookup shows the error page.
  loader: async ({ params, location }) => {
    const slug = `${params.citySlug}/${params.querySlug}`

    const saved = isSearchSlug(slug)
      ? await getSavedSearch({ data: { slug } })
      : null

    if (!saved && !location.state.pendingSearch) {
      throw notFound()
    }

    return saved
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ name: 'robots', content: 'noindex' }] }

    const label = searchLabel(loaderData)
    const name = label.charAt(0).toUpperCase() + label.slice(1)
    const url = `${SITE_URL}results/${loaderData.slug}`

    return {
      meta: [
        { title: `${name} | Permit Search` },
        {
          name: 'description',
          content: `Official permit pages and forms for ${label}.`,
        },
        // Only repeated searches are listed; see isIndexableSearch.
        ...(loaderData.isIndexable
          ? []
          : [{ name: 'robots', content: 'noindex' }]),
      ],
      links: [{ rel: 'canonical', href: url }],
    }
  },
  component: SearchPage,
  notFoundComponent: NoResults,
})

function usePendingSearch() {
  return useLocation({ select: (location) => location.state.pendingSearch })
}

// One ResultsPage whether the search is running or done, so finishing fills in
// the results rather than rebuilding the page around them.
function SearchPage() {
  const loaded = Route.useLoaderData()
  const { citySlug, querySlug } = Route.useParams()
  const pending = usePendingSearch()
  const running = useRunningSearch(pending)

  // What the search just saved, until the loader has it too. This route stays
  // mounted when going to another search, so it has to be this search's.
  const finished =
    running.finished?.slug === `${citySlug}/${querySlug}`
      ? running.finished
      : undefined

  const saved = finished ?? loaded

  if (pending && !finished) {
    return (
      <ResultsPage
        search={pending}
        // Holds the line "Saved results" will take, so the page doesn't move.
        meta={<span>{running.error ? 'Search failed' : 'Searching…'}</span>}
      >
        <RunningSearchStatus {...running} city={pending.city} />
      </ResultsPage>
    )
  }

  if (!saved) return <NoResults />

  return (
    <ResultsPage
      search={{ city: saved.city, permit: saved.permit }}
      resultCount={saved.response.results.length}
      meta={<SearchStatus saved={saved} />}
      searchSlug={saved.slug}
    >
      <SearchResultsList
        response={saved.response}
        city={saved.city}
        searchSlug={saved.slug}
      />
    </ResultsPage>
  )
}

// The server can't see history state, so reloading while a search runs lands
// here; loading again in the browser picks the search back up.
function NoResults() {
  const router = useRouter()
  const pending = usePendingSearch()

  useEffect(() => {
    if (pending) void router.invalidate()
  }, [pending, router])

  return (
    <ResultsPage>
      <p className="text-sm text-ink/70">
        There are no results for this search yet. Search for it above.
      </p>
    </ResultsPage>
  )
}

// Runs (or reuses) the page's pending search, then loads what was saved.
// Clearing the pending search means going back to this page doesn't run it
// again. The results are in hand first, so the page never passes through having
// neither; the sign-in state and sidebar haven't changed, so they don't reload.
function useRunningSearch(search: PendingSearch | undefined) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [online, setOnline] = useState<OnlineApplicationsPreview | null>(null)
  const [finished, setFinished] = useState<SavedSearch | null>(null)

  useEffect(() => {
    if (!search) return

    let cancelled = false
    const key = JSON.stringify(search)
    let request = runningSearches.get(key)

    if (!request) {
      const started = startSearch({
        data: {
          city: { ...search.city, country: 'United States' },
          permit: search.permit,
          fresh: search.fresh,
        },
      })

      request = {
        online: started.then((running) => running.online),
        saved: started
          .then((running) => running.saved)
          .finally(() => runningSearches.delete(key)),
      }
      runningSearches.set(key, request)
    }

    setError('')
    setOnline(null)
    setFinished(null)
    // A failure here is shown by the saved search below.
    request.online.then(
      (preview) => {
        if (!cancelled) setOnline(preview)
      },
      () => {},
    )
    request.saved
      .then(async ({ slug }) => {
        const saved = await getSavedSearch({ data: { slug } })

        if (cancelled) return

        setFinished(saved)

        if (saved) {
          await navigate({
            ...searchPageTarget(search),
            state: {},
            replace: true,
            resetScroll: false,
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
  }, [search, navigate])

  return { error, online, finished }
}

function RunningSearchStatus({
  error,
  online,
  city,
}: {
  error: string
  online: OnlineApplicationsPreview | null
  city: PendingSearch['city']
}) {
  if (error) {
    return (
      <Notice tone="error" className="mt-6">
        {error}
      </Notice>
    )
  }

  if (online) {
    return (
      <>
        <OnlineApplications response={online} city={city} />
        <div
          className="mt-8 flex items-center gap-3 border-t border-ink/20 py-6 text-sm text-ink/70"
          role="status"
        >
          <span className="size-4 spinner" />
          Searching for forms and pages…
        </div>
      </>
    )
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-24 text-sm text-ink/70"
      role="status"
    >
      <span className="size-6 spinner" />
      Searching official sources…
    </div>
  )
}

// Whether these results were just run or reused. "Search again" appears only
// once a fresh run is allowed; the timing isn't shown. Signed out, it asks them
// to sign in, since a new run costs money.
function SearchStatus({ saved }: { saved: SavedSearch }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const resumeAction = `search-again:${saved.slug}`

  const searchAgain = searchPageTarget({
    city: saved.city,
    permit: saved.permit,
    fresh: true,
  })

  useResumeAfterSignIn(resumeAction, Boolean(user), () => {
    void navigate(searchAgain)
  })

  if (saved.ageMinutes < NEW_FOR_MINUTES) {
    return <span>New results</span>
  }

  return (
    <>
      <span>Saved results</span>
      {saved.ageMinutes >= SEARCH_REFRESH_HOURS * 60 && (
        <>
          <span aria-hidden="true">·</span>
          {user ? (
            <Link
              className="font-medium text-blueprint underline-offset-2 hover:underline"
              {...searchAgain}
            >
              Search again
            </Link>
          ) : (
            <SignInButton
              className="font-medium text-blueprint underline-offset-2 hover:underline"
              reason="Sign in to run this search again."
              resume={resumeAction}
            >
              Search again
            </SignInButton>
          )}
        </>
      )}
    </>
  )
}
