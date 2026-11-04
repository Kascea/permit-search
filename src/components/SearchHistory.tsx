import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { HistoryItem } from '#/lib/history/history.server'
import { removeSearchHistory } from '#/lib/history/history'
import { formatCity } from '#/lib/location/format'
import { confirm } from '#/components/ConfirmDialog'

// The signed-in user's searches, each removable, on /history.
export function SearchHistory({ history }: { history: Array<HistoryItem> }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string>()

  async function remove(publicId?: string) {
    if (
      !publicId &&
      !(await confirm({
        title: 'Clear your whole search history?',
        message: 'This can’t be undone.',
        confirmLabel: 'Clear history',
        isDestructive: true,
      }))
    ) {
      return
    }

    setBusyId(publicId ?? 'all')

    try {
      await removeSearchHistory({ data: { publicId } })
      await router.invalidate()
      toast.success(publicId ? 'Search removed.' : 'History cleared.')
    } catch {
      toast.error('Your history couldn’t be updated. Try again.')
    } finally {
      setBusyId(undefined)
    }
  }

  if (history.length === 0) {
    return (
      <p className="border-t border-ink pt-5 text-base leading-6 text-ink/70">
        No searches yet. Searches you run while signed in appear here.
      </p>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
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

      <ul className="mt-3 divide-y divide-ink/20 border-t border-b border-ink">
        {history.map((item) => (
          <li
            key={item.publicId}
            className="flex items-start gap-4 py-4"
          >
            <SearchHistoryLink item={item} />
            <button
              type="button"
              aria-label={`Remove “${item.permit}” from history`}
              disabled={busyId !== undefined}
              className="shrink-0 text-sm text-ink/60 underline-offset-2 hover:text-redline hover:underline disabled:opacity-50"
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

// A past search's permit and details, linking to its saved results.
function SearchHistoryLink({ item }: { item: HistoryItem }) {
  return (
    <Link
      to="/search/results/$searchId"
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
