import { useEffect, useState, useSyncExternalStore } from 'react'

import { listAccountProjects } from '#/lib/projects/projects'
import type { Project } from '#/lib/projects/types'

// The signed-in user's projects, shared by the editor and its sidebar. Kept
// between editor visits so switching forms doesn't flash an empty list, and
// reloaded each time a page using it mounts.
let cachedProjects: Array<Project> | undefined
let pending: Promise<void> | undefined
const listeners = new Set<() => void>()

// Also takes the list a project change returns, so every user sees it.
export function setAccountProjects(projects: Array<Project> | undefined) {
  cachedProjects = projects

  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

// Undefined while loading; empty when signed out.
export function useAccountProjects(signedIn: boolean) {
  const projects = useSyncExternalStore(
    subscribe,
    () => cachedProjects,
    () => undefined,
  )

  const [error, setError] = useState(false)

  useEffect(() => {
    if (!signedIn) {
      // So the next account to sign in doesn't see these.
      setAccountProjects(undefined)

      return
    }

    let cancelled = false
    // Components mounting together share one request.
    pending ??= listAccountProjects()
      .then((loaded) => setAccountProjects(loaded ?? []))
      .finally(() => {
        pending = undefined
      })
    pending.then(
      () => {
        if (!cancelled) setError(false)
      },
      () => {
        if (!cancelled) setError(true)
      },
    )

    return () => {
      cancelled = true
    }
  }, [signedIn])

  return { projects: signedIn ? projects : [], error }
}
