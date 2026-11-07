import { searchRouteParams } from '#/lib/navigation/origin'
import { searchSlug } from '#/lib/saved-searches/search-key'

// A search to run once its page opens. Its address can be worked out without
// running it, so the page opens at its final URL straight away. This travels in
// the browser's history state rather than the URL: a slug can't be turned back
// into the wording, and a link or a crawler must never start a paid search.
export interface PendingSearch {
  city: { name: string; region: string }
  permit: string
  // Run the search even when a recent matching one is saved.
  fresh?: boolean
}

declare module '@tanstack/history' {
  interface HistoryState {
    pendingSearch?: PendingSearch
  }
}

// Where to go to run a search, for a Link or navigate().
export function searchPageTarget(search: PendingSearch) {
  return {
    to: '/results/$citySlug/$querySlug',
    params: searchRouteParams(
      searchSlug(search.city.name, search.city.region, search.permit),
    ),
    state: { pendingSearch: search },
  } as const
}
