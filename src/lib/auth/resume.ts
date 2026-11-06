import { useEffect, useRef } from 'react'
import { z } from 'zod'

// Finishes what the visitor was doing when they were asked to sign in. Kept in
// sessionStorage because Google sign-in leaves the site and comes back. Storage
// can be blocked; then the visitor just clicks again.
const STORAGE_KEY = 'permit-search:resume-after-sign-in'

// An abandoned sign-in shouldn't fire when they sign in much later.
const MAX_AGE_MS = 10 * 60 * 1000

const storedSchema = z.object({ action: z.string(), at: z.number() })

export function rememberResume(action: string) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ action, at: Date.now() }),
    )
  } catch {
    // Nothing is resumed; the sign-in itself still works.
  }
}

function takeResume(action: string) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const stored = storedSchema.safeParse(raw ? JSON.parse(raw) : null)

    if (!stored.success || stored.data.action !== action) return false

    sessionStorage.removeItem(STORAGE_KEY)

    return Date.now() - stored.data.at < MAX_AGE_MS
  } catch {
    return false
  }
}

// Runs `run` once `isReady` is true, if the visitor signed in from the button
// with this action as its `resume`.
export function useResumeAfterSignIn(
  action: string,
  isReady: boolean,
  run: () => void,
) {
  const runRef = useRef(run)

  // Before the effect below, so it runs the latest one.
  useEffect(() => {
    runRef.current = run
  })

  useEffect(() => {
    if (isReady && takeResume(action)) runRef.current()
  }, [action, isReady])
}
