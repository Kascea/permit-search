import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useAuth } from '#/lib/auth/use-auth'
import { importAccountDrafts } from '#/lib/drafts/drafts'
import { deleteLocalDraft, listLocalDrafts } from '#/lib/drafts/local'

// After sign-in, moves drafts saved in this browser to the account. Renders
// nothing.
export function LocalDraftSync() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    const drafts = listLocalDrafts()

    if (drafts.length === 0) return

    importAccountDrafts({ data: { drafts: drafts.slice(0, 100) } })
      .then(() => {
        for (const draft of drafts.slice(0, 100)) {
          deleteLocalDraft(draft.sourceUrl, draft.projectId)
        }

        // The page may have loaded the account's drafts before these joined.
        return router.invalidate()
      })
      .catch((cause: unknown) => {
        // Kept locally; the next page load tries again.
        console.error('Local drafts could not be synced.', cause)
      })
  }, [user, router])

  return null
}
