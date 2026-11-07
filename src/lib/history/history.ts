import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { withUserDatabase } from '#/lib/auth/auth.server'
import { listHistory, removeHistory } from '#/lib/history/history.server'
import { UserError } from '#/lib/errors'
import { isSearchSlug } from '#/lib/saved-searches/search-key'

// Null when signed out, so the history page can ask the visitor to sign in.
export const getSearchHistory = createServerFn({ method: 'GET' }).handler(() =>
  withUserDatabase(
    new Headers(getRequestHeaders()),
    (userId, db) => listHistory(db, userId),
    () => null,
  ),
)

// Removes one search from the user's history, or all of it without a slug.
export const removeSearchHistory = createServerFn({ method: 'POST' })
  .validator((input: { slug?: string }) => {
    if (
      input.slug !== undefined &&
      !isSearchSlug(input.slug)
    ) {
      throw new UserError('That search is not valid.')
    }

    return { slug: input.slug }
  })
  .handler(async ({ data }) => {
    await withUserDatabase(new Headers(getRequestHeaders()), (userId, db) =>
      removeHistory(db, userId, data.slug),
    )
  })
