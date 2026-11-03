import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { withUserDatabase } from '#/lib/auth/auth.server'
import { listHistory, removeHistory } from '#/lib/history/history.server'
import { UserError } from '#/lib/errors'

// Null when signed out, so the history page can ask the visitor to sign in.
export const getSearchHistory = createServerFn({ method: 'GET' }).handler(() =>
  withUserDatabase(
    new Headers(getRequestHeaders()),
    (userId, db) => listHistory(db, userId),
    () => null,
  ),
)

// Removes one search from the user's history, or all of it without a publicId.
export const removeSearchHistory = createServerFn({ method: 'POST' })
  .validator((input: { publicId?: string }) => {
    if (
      input.publicId !== undefined &&
      !/^[A-Za-z0-9]{8,16}$/.test(input.publicId)
    ) {
      throw new UserError('That search is not valid.')
    }
    return { publicId: input.publicId }
  })
  .handler(async ({ data }) => {
    await withUserDatabase(new Headers(getRequestHeaders()), (userId, db) =>
      removeHistory(db, userId, data.publicId),
    )
  })
