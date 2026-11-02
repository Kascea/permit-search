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
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }),
      )
      throw new UserError(GENERIC_ERROR)
    }
  },
)

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
