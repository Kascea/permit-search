import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { limitRequest } from '#/lib/rate-limit.server'

// For server functions anyone can call that cost money per call (Tavily,
// TypeSafe) or write to the database. Each function is counted separately.
export const rateLimited = createMiddleware({ type: 'function' }).server(
  async ({ next, serverFnMeta }) => {
    await limitRequest(serverFnMeta.name, new Headers(getRequestHeaders()))

    return next()
  },
)
