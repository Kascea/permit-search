import type { z } from 'zod'

// An error whose message is written for the person using the app, such as a
// validation message. Server functions send these messages to the browser;
// any other error reaches it as GENERIC_ERROR (see src/start.ts).
export class UserError extends Error {
  // An own property, so it survives serialization to the browser, where the
  // error arrives as a plain Error.
  name = 'UserError'
}

export const GENERIC_ERROR = 'Something went wrong. Try again.'

export function isUserError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'UserError'
}

// The message to show for a caught error: a UserError's own message, or the
// fallback for anything else (database errors, failed requests, bugs).
export function errorMessage(cause: unknown, fallback = GENERIC_ERROR) {
  return isUserError(cause) ? cause.message : fallback
}

// A server function validator. The schema's issue messages are written for
// people, so the first one is thrown as a UserError.
export function parseUserInput<Schema extends z.ZodType>(schema: Schema) {
  return (input: z.input<Schema>): z.output<Schema> => {
    const result = schema.safeParse(input)

    if (result.success) return result.data

    throw new UserError(result.error.issues[0]?.message ?? GENERIC_ERROR)
  }
}
