import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { getSessionUser, requireUserId } from '#/lib/auth/auth.server'
import { listHistory, removeHistory } from '#/lib/history/history.server'

// Null when signed out, so the history page can ask the visitor to sign in.
export const getSearchHistory = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getSessionUser(new Headers(getRequestHeaders()))
    return user ? listHistory(user.id) : null
  },
)

// Removes one search from the user's history, or all of it without a publicId.
export const removeSearchHistory = createServerFn({ method: 'POST' })
  .validator((input: { publicId?: string }) => {
    if (
      input.publicId !== undefined &&
      !/^[A-Za-z0-9]{8,16}$/.test(input.publicId)
    ) {
      throw new Error('That search is not valid.')
    }
    return { publicId: input.publicId }
  })
  .handler(async ({ data }) => {
    const userId = await requireUserId(new Headers(getRequestHeaders()))
    await removeHistory(userId, data.publicId)
  })
