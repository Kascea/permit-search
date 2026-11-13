import { createAuthClient } from 'better-auth/react'
import { toast } from 'sonner'

// Same origin as the site, so no baseURL is needed.
export const authClient = createAuthClient()

// Auth calls return failures as `{ error }`, but throw when the request itself
// fails, such as when offline. This returns those as `{ error }` too, so
// callers handle both in one place.
export function settled<T>(request: Promise<T>) {
  return request.catch((): RequestFailure => ({
    data: null,
    error: { code: undefined },
  }))
}

// What settled resolves to when the request itself fails. The code's type
// matches Better Auth's own errors, so callers can read it either way.
interface RequestFailure {
  data: null
  error: { code: string | undefined }
}

// Sends the browser to Google, then back to `returnTo` on this site. On
// failure it comes back to the page it started from with ?error=<code>, which
// OAuthErrorToast reads, instead of Better Auth's own error page.
export async function signInWithGoogle(returnTo: string) {
  const { error } = await settled(
    authClient.signIn.social({
      provider: 'google',
      callbackURL: returnTo,
      errorCallbackURL: window.location.pathname + window.location.search,
    }),
  )

  if (error) toast.error('Google sign-in couldn’t start. Try again.')
}
