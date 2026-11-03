import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { withUserDatabase } from '#/lib/auth/auth.server'
import type { Database } from '#/lib/db/client.server'
import {
  deleteDraft,
  importDrafts,
  listDrafts,
  loadDraft,
  saveDraft,
} from '#/lib/drafts/drafts.server'
import { draftSchema } from '#/lib/drafts/types'
import { UserError, parseUserInput } from '#/lib/errors'
import { projectSourceUrlSchema, publicIdSchema } from '#/lib/projects/types'

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

const parseSourceUrl = parseUserInput(
  z.object({ sourceUrl: projectSourceUrlSchema }),
)

const parseDraftPublicId = parseUserInput(
  z.object({ publicId: publicIdSchema('draft') }),
)

const tooManyDrafts = 'Too many drafts to import at once.'

export const getAccountDraft = createServerFn({ method: 'GET' })
  .validator(parseSourceUrl)
  .handler(({ data }) =>
    withDraftUser((db, userId) => loadDraft(db, userId, data.sourceUrl)),
  )

export const saveAccountDraft = createServerFn({ method: 'POST' })
  .validator(parseUserInput(draftSchema))
  .handler(({ data }) =>
    withDraftUser((db, userId) => saveDraft(db, userId, data)),
  )

// Moves drafts saved in the browser before sign-in to the account.
export const importAccountDrafts = createServerFn({ method: 'POST' })
  .validator(
    parseUserInput(
      z.object({
        drafts: z
          .array(draftSchema, { error: tooManyDrafts })
          .max(100, tooManyDrafts),
      }),
    ),
  )
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
  .validator((input: { publicId: string } | { sourceUrl: string }) =>
    'publicId' in input ? parseDraftPublicId(input) : parseSourceUrl(input),
  )
  .handler(({ data }) =>
    withDraftUser((db, userId) => deleteDraft(db, userId, data)),
  )
