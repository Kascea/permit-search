import { createFileRoute } from '@tanstack/react-router'

import { AppPage } from '#/components/AppPage'
import { SearchHistory } from '#/components/SearchHistory'
import { SignInButton } from '#/components/SignInDialog'
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
      <h1 className="mt-1 mb-6 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
        Your searches
      </h1>

      {history ? (
        <SearchHistory history={history} />
      ) : (
        <div className="border-t border-ink pt-5">
          <p className="text-base leading-6 text-ink/70">
            Sign in to keep a history of your permit searches.
          </p>
          <SignInButton className="mt-5 rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep" />
        </div>
      )}
    </AppPage>
  )
}
