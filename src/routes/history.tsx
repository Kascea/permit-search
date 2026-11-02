import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { SignInButton } from '#/components/SignInDialog'
import { SiteFooter } from '#/components/SiteFooter'
import { SiteHeader } from '#/components/SiteHeader'
import { getSearchHistory, removeSearchHistory } from '#/lib/history/history'
import type { HistoryItem } from '#/lib/history/history.server'
import { formatCity } from '#/lib/location/format'

export const Route = createFileRoute('/history')({
  head: () => ({
    meta: [{ title: 'History | Permit Search' }],
  }),
  loader: () => getSearchHistory(),
  component: History,
})

function History() {
  const history = Route.useLoaderData()

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 sm:px-6">
        <section className="mx-auto max-w-[780px] py-8">
          <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
            History
          </p>
          <h1 className="mt-1 text-[28px] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
            Your searches
          </h1>

          {history ? (
            <HistoryList history={history} />
          ) : (
            <div className="mt-6 border-t border-ink pt-5">
              <p className="text-base leading-6 text-ink/70">
                Sign in to keep a history of your permit searches.
              </p>
              <SignInButton className="mt-5 rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep" />
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function HistoryList({ history }: { history: Array<HistoryItem> }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string>()
  const [error, setError] = useState('')

  async function remove(publicId?: string) {
    if (
      !publicId &&
      !window.confirm('Clear your whole search history? This can’t be undone.')
    ) {
      return
    }
    setError('')
    setBusyId(publicId ?? 'all')
    try {
      await removeSearchHistory({ data: { publicId } })
      await router.invalidate()
    } catch {
      setError('Your history couldn’t be updated. Try again.')
    } finally {
      setBusyId(undefined)
    }
  }

  if (history.length === 0) {
    return (
      <p className="mt-6 border-t border-ink pt-5 text-base leading-6 text-ink/70">
        No searches yet. Searches you run while signed in appear here.
      </p>
    )
  }

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-ink/60">
          {history.length} {history.length === 1 ? 'search' : 'searches'}
        </p>
        <button
          type="button"
          disabled={busyId !== undefined}
          className="text-sm text-ink/60 underline-offset-2 hover:text-redline hover:underline disabled:opacity-50"
          onClick={() => void remove()}
        >
          Clear history
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-redline" role="alert">
          {error}
        </p>
      )}

      <ul className="mt-3 divide-y divide-ink/20 border-t border-b border-ink">
        {history.map((item) => (
          <li
            key={item.publicId}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4"
          >
            <Link
              to="/results/$searchId"
              params={{ searchId: item.publicId }}
              className="group min-w-0 flex-1"
            >
              <p className="truncate font-medium text-ink group-hover:text-blueprint">
                {item.permit}
              </p>
              <p className="mt-0.5 truncate text-sm text-ink/60">
                {formatCity(item.city)} · {item.resultCount}{' '}
                {item.resultCount === 1 ? 'result' : 'results'} ·{' '}
                {formatSearched(item)}
              </p>
            </Link>
            <button
              type="button"
              aria-label={`Remove “${item.permit}” from history`}
              disabled={busyId !== undefined}
              className="rounded-full border border-ink/35 px-4 py-2 text-sm font-medium transition hover:border-redline hover:text-redline disabled:opacity-50"
              onClick={() => void remove(item.publicId)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

// "Searched Mar 4" or "Searched 3 times, last Mar 4".
function formatSearched(item: HistoryItem) {
  const date = new Date(item.lastSearchedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year:
      new Date(item.lastSearchedAt).getFullYear() === new Date().getFullYear()
        ? undefined
        : 'numeric',
  })
  return item.timesSearched > 1
    ? `Searched ${item.timesSearched} times, last ${date}`
    : `Searched ${date}`
}
