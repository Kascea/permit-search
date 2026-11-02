import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { ResultsPage } from '#/components/ResultsPage'
import { SearchResultsList } from '#/components/SearchResultsList'
import { getSavedSearch } from '#/lib/search/permit-search'

// A fixed time zone so the server and the browser render the same date.
const searchedOn = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

// A saved search, as linked from /results/<id>. Always shows what was saved,
// however old; "Search again" runs it fresh.
export const Route = createFileRoute('/results/$searchId')({
  loader: async ({ params }) => {
    const saved = await getSavedSearch({
      data: { publicId: params.searchId },
    }).catch(() => null)
    if (!saved) {
      throw notFound()
    }
    return saved
  },
  component: SavedResults,
  notFoundComponent: () => (
    <ResultsPage>
      <p className="text-sm text-[#302d2d]/70">
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
      meta={
        <>
          Searched {searchedOn.format(new Date(saved.createdAt))} ·{' '}
          <Link
            className="text-[#1968b4] underline-offset-2 hover:underline"
            to="/results"
            search={{
              city: saved.city.name,
              region: saved.city.region,
              permit: saved.permit,
              fresh: true,
            }}
          >
            Search again
          </Link>
        </>
      }
    >
      <SearchResultsList response={saved.response} />
    </ResultsPage>
  )
}
