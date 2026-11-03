import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { withUserDatabase } from '#/lib/auth/auth.server'
import type { Database } from '#/lib/db/client.server'
import {
  deleteDraft,
  importDrafts,
  listDrafts,
  loadDraft,
  saveDraft,
} from '#/lib/drafts/drafts.server'
import { draftError } from '#/lib/drafts/types'
import type { Draft } from '#/lib/drafts/types'
import { UserError } from '#/lib/errors'

// Drafts belong to the signed-in user; the browser never sends a user ID.
// The session check and the work share one database connection.
function withDraftUser<T>(work: (db: Database, userId: string) => Promise<T>) {
  return withUserDatabase(
    new Headers(getRequestHeaders()),
    (userId, db) => work(db, userId),
    () => {
      throw new UserError('Sign in to save drafts to your account.')
    },
  )
}

function validateDraft(input: Draft): Draft {
  const error = draftError(input)
  if (error) throw new UserError(error)
  return input
}

function validateSourceUrl(input: { sourceUrl: string }) {
  if (
    typeof input.sourceUrl !== 'string' ||
    input.sourceUrl.length > 2_048 ||
    !/^https?:\/\//.test(input.sourceUrl)
  ) {
    throw new UserError('That PDF link is not valid.')
  }
  return { sourceUrl: input.sourceUrl }
}

export const getAccountDraft = createServerFn({ method: 'GET' })
  .validator(validateSourceUrl)
  .handler(({ data }) =>
    withDraftUser((db, userId) => loadDraft(db, userId, data.sourceUrl)),
  )

export const saveAccountDraft = createServerFn({ method: 'POST' })
  .validator(validateDraft)
  .handler(({ data }) =>
    withDraftUser((db, userId) => saveDraft(db, userId, data)),
  )

// Moves drafts saved in the browser before sign-in to the account.
export const importAccountDrafts = createServerFn({ method: 'POST' })
  .validator((input: { drafts: Array<Draft> }) => {
    if (!Array.isArray(input.drafts) || input.drafts.length > 100) {
      throw new UserError('Too many drafts to import at once.')
    }
    return { drafts: input.drafts.map(validateDraft) }
  })
  .handler(({ data }) =>
    withDraftUser((db, userId) => importDrafts(db, userId, data.drafts)),
  )

// Null when signed out, so the drafts page can ask the visitor to sign in.
export const listAccountDrafts = createServerFn({ method: 'GET' }).handler(() =>
  withUserDatabase(
    new Headers(getRequestHeaders()),
    (userId, db) => listDrafts(db, userId),
    () => null,
  ),
)

export const deleteAccountDraft = createServerFn({ method: 'POST' })
  .validator((input: { publicId: string } | { sourceUrl: string }) => {
    if ('publicId' in input) {
      if (!/^[A-Za-z0-9]{8,16}$/.test(input.publicId)) {
        throw new UserError('That draft is not valid.')
      }
      return { publicId: input.publicId }
    }
    return validateSourceUrl(input)
  })
  .handler(({ data }) =>
    withDraftUser((db, userId) => deleteDraft(db, userId, data)),
  )
