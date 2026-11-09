import { errorMessage, isUserError } from '#/lib/errors'

// The browser extension's ID, fixed by the "key" in extension/public/manifest.json.
export const EXTENSION_ORIGIN = 'chrome-extension://jmakciodggmnnppkndiclidelibnhcil'

const ALLOWED_ORIGINS = new Set([
  EXTENSION_ORIGIN,
  'https://permitsearch.app',
  'https://www.permitsearch.app',
  ...(import.meta.env.DEV ? ['http://localhost:3000'] : []),
])

// Signed out: the extension shows its Sign in button.
export class SignedOutError extends Error {}

// Runs an extension API request and turns its errors into JSON. Only the
// extension and the site itself may call these routes. The session cookie is
// SameSite=Lax, so other sites can't send it with a POST anyway; this also
// keeps them from reading the answers.
export async function extensionResponse<T>(
  request: Request,
  work: () => Promise<T>,
) {
  const origin = request.headers.get('origin')

  if (origin !== null && !ALLOWED_ORIGINS.has(origin)) {
    return Response.json({ error: 'Not allowed.' }, { status: 403 })
  }

  if (request.method !== 'GET' && origin === null) {
    return Response.json({ error: 'Not allowed.' }, { status: 403 })
  }

  try {
    return Response.json(await work(), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    if (error instanceof SignedOutError) {
      return Response.json({ error: 'Sign in to continue.' }, { status: 401 })
    }

    if (!isUserError(error)) {
      console.error(
        JSON.stringify({
          message: 'extension request failed',
          path: new URL(request.url).pathname,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    }

    return Response.json(
      { error: errorMessage(error) },
      { status: isUserError(error) ? 400 : 500 },
    )
  }
}

export function signedOut(): never {
  throw new SignedOutError()
}
