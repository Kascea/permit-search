import { useSyncExternalStore } from 'react'
import { z } from 'zod'

// The search the header's pill shows and its modal starts from, kept in this
// browser so it stays the same from page to page until the user clears it.
// Viewing a search's results makes it the current search.
export interface CurrentSearch {
  city: { name: string; region: string }
  permit: string
}

const KEY = 'permit-search:current-search:v1'

const currentSearchSchema = z.object({
  city: z.object({ name: z.string().min(1), region: z.string() }),
  permit: z.string(),
})

const listeners = new Set<() => void>()

// The snapshot must be the same object until storage changes, so the parsed
// value is kept with the text it came from.
let cachedRaw: string | null = null
let cachedSearch: CurrentSearch | null = null

// Storage can be blocked, so reads fall back to no search.
function readCurrentSearch(): CurrentSearch | null {
  let raw: string | null

  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return null
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw

    try {
      const parsed = currentSearchSchema.safeParse(raw ? JSON.parse(raw) : null)

      cachedSearch = parsed.success ? parsed.data : null
    } catch {
      cachedSearch = null
    }
  }

  return cachedSearch
}

function write(search: CurrentSearch | null) {
  try {
    if (search) localStorage.setItem(KEY, JSON.stringify(search))
    else localStorage.removeItem(KEY)
  } catch {
    // Not remembered, but nothing else depends on it.
  }

  for (const listener of listeners) listener()
}

export function setCurrentSearch(search: CurrentSearch) {
  const current = readCurrentSearch()

  if (
    current?.city.name === search.city.name &&
    current.city.region === search.city.region &&
    current.permit === search.permit
  ) {
    return
  }

  write({ city: search.city, permit: search.permit })
}

export function clearCurrentSearch() {
  write(null)
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  // Another tab's change shows here too.
  window.addEventListener('storage', listener)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

// Null when there's none, and on the server, which can't see storage.
export function useCurrentSearch() {
  return useSyncExternalStore(subscribe, readCurrentSearch, () => null)
}
