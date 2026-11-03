import { draftSchema } from '#/lib/drafts/types'
import type { Draft } from '#/lib/drafts/types'

// Drafts kept in this browser for people who aren't signed in. Storage can be
// blocked or full, so every call fails quietly.
const PREFIX = 'permit-search:draft:v1:'

export function getLocalDraft(sourceUrl: string): Draft | null {
  try {
    const raw = localStorage.getItem(PREFIX + sourceUrl)
    const draft = draftSchema.safeParse(raw ? JSON.parse(raw) : null)

    return draft.success ? draft.data : null
  } catch {
    return null
  }
}

// Returns false when the browser wouldn't store it.
export function saveLocalDraft(draft: Draft) {
  try {
    localStorage.setItem(PREFIX + draft.sourceUrl, JSON.stringify(draft))

    return true
  } catch {
    return false
  }
}

export function deleteLocalDraft(sourceUrl: string) {
  try {
    localStorage.removeItem(PREFIX + sourceUrl)
  } catch {
    // Nothing to clean up.
  }
}

export function listLocalDrafts(): Array<Draft> {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .map((key) => getLocalDraft(key.slice(PREFIX.length)))
      .filter((draft): draft is Draft => draft !== null)
  } catch {
    return []
  }
}
