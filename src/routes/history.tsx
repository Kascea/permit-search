import { createFileRoute } from '@tanstack/react-router'

import { AppPage } from '#/components/AppPage'
import { SearchHistory } from '#/components/SearchHistory'
import { SignInGate } from '#/components/SignInGate'
import { getSearchHistory } from '#/lib/history/history'

// The user's past searches. New searches start from the header's search pill.
export const Route = createFileRoute('/history')({
  head: () => ({
    meta: [{ title: 'History | Permit Search' }],
  }),
  // Null when signed out, so the page can ask the visitor to sign in.
  loader: () => getSearchHistory(),
  component: History,
})

function History() {
  const history = Route.useLoaderData()

  return (
    <AppPage>
      <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
        History
      </p>
      <h1 className="mt-1 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
        Your searches
      </h1>

      {history ? (
        <div className="mt-6">
          <SearchHistory history={history} />
        </div>
      ) : (
        <SignInGate>
          Sign in to keep a history of your permit searches.
        </SignInGate>
      )}
    </AppPage>
  )
}
