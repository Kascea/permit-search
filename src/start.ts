import {
  createSerializationAdapter,
  isNotFound,
  isRedirect,
} from '@tanstack/react-router'
import { createMiddleware, createStart } from '@tanstack/react-start'

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
function describeError(error: unknown) {
  if (!(error instanceof Error)) return { error: String(error) }
  const { cause } = error
  if ('query' in error && typeof error.query === 'string') {
    return {
      error:
        cause instanceof Error ? cause.message : 'Database query failed.',
      code:
        cause && typeof cause === 'object' && 'code' in cause
          ? cause.code
          : undefined,
      query: error.query.replace(/\s+/g, ' ').slice(0, 500),
      // Just the frames: the stack starts by repeating the message.
      stack: error.stack?.slice(error.stack.indexOf('\n    at ') + 1),
    }
  }
  return {
    error: error.message,
    cause: cause instanceof Error ? cause.message : undefined,
    stack: error.stack,
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

export const startInstance = createStart(() => ({
  functionMiddleware: [hideInternalErrors],
  serializationAdapters: [userErrorAdapter],
}))
