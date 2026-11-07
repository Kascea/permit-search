import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
} from '@tanstack/react-router'

import { ResultsPage } from '#/components/ResultsPage'
import { SearchResultsList } from '#/components/SearchResultsList'
import { SignInButton } from '#/components/SignInDialog'
import { useResumeAfterSignIn } from '#/lib/auth/resume'
import { useAuth } from '#/lib/auth/use-auth'
import { SEARCH_REFRESH_HOURS } from '#/lib/saved-searches/search-key'
import { getSavedSearch } from '#/lib/search/permit-search'
import type { SavedSearch } from '#/lib/saved-searches/saved-searches.server'

// Results this young were just run for this visitor (or someone moments
// before), so they're labeled new rather than saved.
const NEW_FOR_MINUTES = 10

// A saved search, as linked from /search/results/<id>. Always shows what was
// saved, however old; "Search again" runs it fresh, at most once a day.
export const Route = createFileRoute('/search/results/$searchId')({
  // A malformed link is "not found"; a failed lookup shows the error page.
  loader: async ({ params }) => {
    const saved = /^[A-Za-z0-9]{8,16}$/.test(params.searchId)
      ? await getSavedSearch({ data: { publicId: params.searchId } })
      : null

    if (!saved) {
      throw notFound()
    }

    return saved
  },
  component: SavedResults,
  notFoundComponent: () => (
    <ResultsPage>
      <p className="text-sm text-ink/70">
        This search link has expired or doesn’t exist.
      </p>
    </ResultsPage>
  ),
})

function SavedResults() {
  const saved = Route.useLoaderData()

  return (
    <ResultsPage
      search={{ city: saved.city, permit: saved.permit }}
      resultCount={saved.response.results.length}
      meta={<SearchStatus saved={saved} />}
      searchId={saved.publicId}
    >
      <SearchResultsList
        response={saved.response}
        city={saved.city}
        searchId={saved.publicId}
      />
    </ResultsPage>
  )
}

// Whether these results were just run or reused. "Search again" appears only
// once a fresh run is allowed; the timing isn't shown. Signed out, it asks them
// to sign in, since a new run costs money.
function SearchStatus({ saved }: { saved: SavedSearch }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const resumeAction = `search-again:${saved.publicId}`

  const freshSearch = {
    city: saved.city.name,
    region: saved.city.region,
    permit: saved.permit,
    fresh: true,
  }

  useResumeAfterSignIn(resumeAction, Boolean(user), () => {
    void navigate({ to: '/search/results', search: freshSearch })
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
              to="/search/results"
              search={freshSearch}
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
