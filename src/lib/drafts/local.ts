import { draftSchema } from '#/lib/drafts/types'
import type { Draft } from '#/lib/drafts/types'

// Drafts kept in this browser for people who aren't signed in, and for edits
// that couldn't reach the account. Storage can be blocked or full, so every
// call fails quietly.
const PREFIX = 'permit-search:draft:v1:'

// A project's copy of a form is kept apart from the same form's copy elsewhere.
function storageKey(sourceUrl: string, projectId: string | undefined) {
  return `${PREFIX}${projectId ? `project:${projectId}:` : ''}${sourceUrl}`
}

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key)
    const draft = draftSchema.safeParse(raw ? JSON.parse(raw) : null)

    return draft.success ? draft.data : null
  } catch {
    return null
  }
}

export function getLocalDraft(sourceUrl: string, projectId?: string) {
  return readDraft(storageKey(sourceUrl, projectId))
}

// Returns false when the browser wouldn't store it.
export function saveLocalDraft(draft: Draft) {
  try {
    localStorage.setItem(
      storageKey(draft.sourceUrl, draft.projectId),
      JSON.stringify(draft),
    )

    return true
  } catch {
    return false
  }
}

export function deleteLocalDraft(sourceUrl: string, projectId?: string) {
  try {
    localStorage.removeItem(storageKey(sourceUrl, projectId))
  } catch {
    // Nothing to clean up.
  }
}

export function listLocalDrafts(): Array<Draft> {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .map((key) => readDraft(key))
      .filter((draft): draft is Draft => draft !== null)
  } catch {
    return []
  }
}
