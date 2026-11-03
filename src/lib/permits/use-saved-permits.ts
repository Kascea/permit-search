import { useEffect, useSyncExternalStore } from 'react'

import { listAccountPermits } from '#/lib/permits/permits'
import type { SavedPermit } from '#/lib/permits/types'

// The signed-in user's library, for marking search results already saved.
// Reloaded each time a page using it mounts.
let cachedPermits: Array<SavedPermit> | undefined
let pending: Promise<void> | undefined
const listeners = new Set<() => void>()

// Also takes the library a change returns, so every user sees it.
export function setSavedPermits(permits: Array<SavedPermit> | undefined) {
  cachedPermits = permits

  for (const listener of listeners) listener()
}

// Adds or replaces one permit, such as one just saved.
export function putSavedPermit(permit: SavedPermit) {
  setSavedPermits([
    ...(cachedPermits ?? []).filter(
      (each) => each.publicId !== permit.publicId,
    ),
    permit,
  ])
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

// Undefined while loading; empty when signed out.
export function useSavedPermits(signedIn: boolean) {
  const permits = useSyncExternalStore(
    subscribe,
    () => cachedPermits,
    () => undefined,
  )

  useEffect(() => {
    if (!signedIn) {
      setSavedPermits(undefined)

      return
    }

    // Components mounting together share one request. A failure leaves the
    // results unmarked; saving again returns the existing permit.
    pending ??= listAccountPermits()
      .then((loaded) => setSavedPermits(loaded ?? []))
      .catch(() => undefined)
      .finally(() => {
        pending = undefined
      })
  }, [signedIn])

  return signedIn ? permits : []
}
