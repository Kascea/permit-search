import {
  createSerializationAdapter,
  isNotFound,
  isRedirect,
} from '@tanstack/react-router'
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'
import { DrizzleQueryError } from 'drizzle-orm'

import { GENERIC_ERROR, UserError, isUserError } from '#/lib/errors'

// Server functions send thrown errors to the browser, message and all. Only a
// UserError's message is meant for people; anything else, such as a database
// error, is logged here and replaced with a generic one.
const hideInternalErrors = createMiddleware({ type: 'function' }).server(
  async ({ next, serverFnMeta }) => {
    try {
      return await next()
    } catch (error) {
      if (
        isUserError(error) ||
        isRedirect(error) ||
        isNotFound(error) ||
        error instanceof Response
      ) {
        throw error
      }

      console.error(
        JSON.stringify({
          message: 'server function failed',
          function: serverFnMeta.name,
          ...describeError(error),
        }),
      )
      throw new UserError(GENERIC_ERROR)
    }
  },
)

// What to log about an error. A failed Drizzle query's message is the whole
// query plus its params, which can hold people's details, so for those only
// the query and the database's own error (its cause) are logged.
function describeError(cause: unknown) {
  if (!(cause instanceof Error)) return { error: String(cause) }

  if (cause instanceof DrizzleQueryError) {
    const databaseError = cause.cause

    return {
      error: databaseError?.message ?? 'Database query failed.',
      code:
        databaseError && 'code' in databaseError
          ? databaseError.code
          : undefined,
      query: cause.query.replace(/\s+/g, ' ').slice(0, 500),
      // Just the frames: the stack starts by repeating the message.
      stack: cause.stack?.slice(cause.stack.indexOf('\n    at ') + 1),
    }
  }

  return {
    error: cause.message,
    cause: cause.cause instanceof Error ? cause.cause.message : undefined,
    stack: cause.stack,
  }
}

// Errors otherwise reach the browser as plain Errors, carrying only their
// message, so the browser couldn't tell a UserError apart.
const userErrorAdapter = createSerializationAdapter({
  key: 'UserError',
  test: (value): value is UserError => isUserError(value),
  toSerializable: (error) => error.message,
  fromSerializable: (message) => new UserError(message),
})

// Sent with every page, API and server function response. The policy doesn't
// limit scripts, since the page's own hydration scripts are inline, but other
// sites can't frame the app to trick people into clicking in it.
// Geolocation is for "Detect my city".
const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next()
  let { response } = result

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    try {
      response.headers.set(name, value)
    } catch {
      // A Response.redirect()'s headers can't be changed; copy it once.
      response = new Response(response.body, response)
      response.headers.set(name, value)
    }
  }

  return { ...result, response }
})

// Turns away server function calls from other sites, such as a page posting to
// saveAccountDraft with a signed-in visitor's cookie. Start adds this itself
// only when there's no startInstance, so defining one here turned it off.
// /api/auth has Better Auth's own origin check.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  // securityHeaders goes first so it also covers a CSRF rejection.
  requestMiddleware: [securityHeaders, csrfMiddleware],
  functionMiddleware: [hideInternalErrors],
  serializationAdapters: [userErrorAdapter],
}))
