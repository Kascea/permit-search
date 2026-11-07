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
  renameDraft,
  saveDraft,
} from '#/lib/drafts/drafts.server'
import { MAX_DRAFT_NAME_LENGTH, draftSchema } from '#/lib/drafts/types'
import { UserError, parseUserInput } from '#/lib/errors'
import { keepBlankCopy } from '#/lib/pdf/blank-pdf.server'
import { projectSourceUrlSchema, publicIdSchema } from '#/lib/projects/types'
import { rateLimited } from '#/lib/rate-limit'

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

// A form's draft: its URL, and the project whose copy it is, if any.
const parseDraftForm = parseUserInput(
  z.object({
    sourceUrl: projectSourceUrlSchema,
    projectId: publicIdSchema().optional(),
  }),
)

const parseDraftPublicId = parseUserInput(
  z.object({ publicId: publicIdSchema('draft') }),
)

const tooManyDrafts = 'Too many drafts to import at once.'

export const getAccountDraft = createServerFn({ method: 'GET' })
  .validator(parseDraftForm)
  .handler(({ data }) =>
    withDraftUser((db, userId) =>
      loadDraft(db, userId, data.sourceUrl, data.projectId),
    ),
  )

// Keeps the version of the form a draft is filled against; see keepBlankCopy.
export const keepDraftFormCopy = createServerFn({ method: 'POST' })
  .middleware([rateLimited])
  .validator(
    parseUserInput(
      z.object({
        sourceUrl: projectSourceUrlSchema,
        sourceHash: draftSchema.shape.sourceHash,
      }),
    ),
  )
  .handler(({ data }) =>
    withDraftUser((db) =>
      keepBlankCopy(db, data.sourceUrl, data.sourceHash),
    ),
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

const nameError = `Keep the name under ${MAX_DRAFT_NAME_LENGTH} characters.`

// An empty name goes back to the form's title.
export const renameAccountDraft = createServerFn({ method: 'POST' })
  .validator(
    parseUserInput(
      z.object({
        publicId: publicIdSchema('draft'),
        name: z
          .string({ error: nameError })
          .trim()
          .max(MAX_DRAFT_NAME_LENGTH, nameError)
          .transform((name) => name || null),
      }),
    ),
  )
  .handler(({ data }) =>
    withDraftUser((db, userId) =>
      renameDraft(db, userId, data.publicId, data.name),
    ),
  )

export const deleteAccountDraft = createServerFn({ method: 'POST' })
  .validator(
    (input: { publicId: string } | { sourceUrl: string; projectId?: string }) =>
      'publicId' in input ? parseDraftPublicId(input) : parseDraftForm(input),
  )
  .handler(({ data }) =>
    withDraftUser((db, userId) => deleteDraft(db, userId, data)),
  )
