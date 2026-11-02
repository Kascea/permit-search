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
export function errorMessage(error: unknown, fallback = GENERIC_ERROR) {
  return isUserError(error) ? error.message : fallback
}
