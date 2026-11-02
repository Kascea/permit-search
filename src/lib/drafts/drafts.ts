import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { getSessionUser, requireUserId } from '#/lib/auth/auth.server'
import {
  deleteDraft,
  importDrafts,
  listDrafts,
  loadDraft,
  saveDraft,
} from '#/lib/drafts/drafts.server'
import { draftError } from '#/lib/drafts/types'
import type { Draft } from '#/lib/drafts/types'

// Drafts belong to the signed-in user; the browser never sends a user ID.
function currentUserId() {
  return requireUserId(new Headers(getRequestHeaders()))
}

function validateDraft(input: Draft): Draft {
  const error = draftError(input)
  if (error) throw new Error(error)
  return input
}

function validateSourceUrl(input: { sourceUrl: string }) {
  if (
    typeof input.sourceUrl !== 'string' ||
    input.sourceUrl.length > 2_048 ||
    !/^https?:\/\//.test(input.sourceUrl)
  ) {
    throw new Error('That PDF link is not valid.')
  }
  return { sourceUrl: input.sourceUrl }
}

export const getAccountDraft = createServerFn({ method: 'GET' })
  .validator(validateSourceUrl)
  .handler(async ({ data }) => loadDraft(await currentUserId(), data.sourceUrl))

export const saveAccountDraft = createServerFn({ method: 'POST' })
  .validator(validateDraft)
  .handler(async ({ data }) => saveDraft(await currentUserId(), data))

// Moves drafts saved in the browser before sign-in to the account.
export const importAccountDrafts = createServerFn({ method: 'POST' })
  .validator((input: { drafts: Array<Draft> }) => {
    if (!Array.isArray(input.drafts) || input.drafts.length > 100) {
      throw new Error('Too many drafts to import at once.')
    }
    return { drafts: input.drafts.map(validateDraft) }
  })
  .handler(async ({ data }) => importDrafts(await currentUserId(), data.drafts))

// Null when signed out, so the drafts page can ask the visitor to sign in.
export const listAccountDrafts = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getSessionUser(new Headers(getRequestHeaders()))
    return user ? listDrafts(user.id) : null
  },
)

export const deleteAccountDraft = createServerFn({ method: 'POST' })
  .validator((input: { publicId: string } | { sourceUrl: string }) => {
    if ('publicId' in input) {
      if (!/^[A-Za-z0-9]{8,16}$/.test(input.publicId)) {
        throw new Error('That draft is not valid.')
      }
      return { publicId: input.publicId }
    }
    return validateSourceUrl(input)
  })
  .handler(async ({ data }) => deleteDraft(await currentUserId(), data))
