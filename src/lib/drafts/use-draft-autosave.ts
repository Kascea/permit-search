import { useEffect, useRef, useState } from 'react'

import { getAccountDraft, saveAccountDraft } from '#/lib/drafts/drafts'
import { getLocalDraft, saveLocalDraft } from '#/lib/drafts/local'
import type { Draft, DraftContent } from '#/lib/drafts/types'
import { UserError } from '#/lib/errors'

// idle: nothing saved yet. local: saved in this browser only.
export type DraftStatus = 'idle' | 'saving' | 'saved' | 'local' | 'error'

const SAVE_DELAY_MS = 1_200

// The newest saved copy of a PDF's draft: the account's when signed in, or this
// browser's. A local copy newer than the account's is synced on sign-in, so it
// wins here too.
export async function loadNewestDraft(
  sourceUrl: string,
  signedIn: boolean,
): Promise<{ draft: Draft; status: DraftStatus } | null> {
  const local = getLocalDraft(sourceUrl)

  // Fails rather than opening a blank form, whose first autosave would
  // replace the account's draft.
  const account = signedIn
    ? await getAccountDraft({ data: { sourceUrl } }).catch(() => {
        throw new UserError(
          'Your saved draft couldn’t be loaded. Reload to try again.',
        )
      })
    : null

  if (account && (!local || account.updatedAt >= local.updatedAt)) {
    return { draft: account, status: 'saved' }
  }

  return local ? { draft: local, status: 'local' } : null
}

interface DraftAutosaveOptions {
  sourceUrl: string
  // Unset until the PDF has loaded; nothing saves before then.
  sourceHash: string | undefined
  content: DraftContent
  signedIn: boolean
  // The saved search the editor was opened from, if any; see Draft.
  searchId?: string
}

// Saves the editor's fields shortly after each change, and right away when the
// editor closes or the tab is hidden. The first content seen after the PDF
// loads is the baseline and isn't saved.
export function useDraftAutosave({
  sourceUrl,
  sourceHash,
  content,
  signedIn,
  searchId,
}: DraftAutosaveOptions) {
  const [status, setStatus] = useState<DraftStatus>('idle')
  const baselineRef = useRef<string | null>(null)
  // The latest unsaved edit, waiting for the save delay.
  const pendingRef = useRef<Draft | null>(null)
  const signedInRef = useRef(signedIn)
  signedInRef.current = signedIn
  const json = JSON.stringify(content)

  // Reads only refs, so the copy captured at mount still works at unmount.
  function flush({ leaving = false } = {}) {
    const draft = pendingRef.current

    if (!draft) return
    pendingRef.current = null
    baselineRef.current = JSON.stringify(draft.content)

    if (!signedInRef.current) {
      setStatus(saveLocalDraft(draft) ? 'local' : 'error')

      return
    }

    // A request may not finish once the page is going away; the local copy
    // moves to the account on the next visit.
    if (leaving) saveLocalDraft(draft)

    setStatus('saving')
    saveAccountDraft({ data: draft })
      .then(() => setStatus('saved'))
      .catch((cause: unknown) => {
        console.error('The draft could not be saved.', cause)
        // Kept in this browser so the work isn't lost.
        saveLocalDraft(draft)
        setStatus('error')
      })
  }

  useEffect(() => {
    if (!sourceHash) return

    if (baselineRef.current === null) {
      baselineRef.current = json

      return
    }

    if (json === baselineRef.current) {
      pendingRef.current = null

      return
    }

    const draft: Draft = {
      sourceUrl,
      sourceHash,
      // SAFETY: json is JSON.stringify(content), and content is DraftContent.
      content: JSON.parse(json) as DraftContent,
      updatedAt: new Date().toISOString(),
    }

    if (searchId) draft.searchId = searchId

    pendingRef.current = draft
    const timer = window.setTimeout(() => flush(), SAVE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [json, sourceHash, sourceUrl, searchId])

  useEffect(() => {
    function saveOnHide() {
      if (document.visibilityState === 'hidden') flush({ leaving: true })
    }

    document.addEventListener('visibilitychange', saveOnHide)

    return () => {
      document.removeEventListener('visibilitychange', saveOnHide)
      flush({ leaving: true })
    }
  }, [])

  return {
    status,
    setStatus,
    // Marks content the editor is about to show as already saved, such as the
    // PDF's own values after discarding a draft.
    resetBaseline: (next: DraftContent) => {
      pendingRef.current = null
      baselineRef.current = JSON.stringify(next)
    },
  }
}
