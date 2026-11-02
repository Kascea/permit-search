import { createAuthClient } from 'better-auth/react'
import { toast } from 'sonner'

// Same origin as the site, so no baseURL is needed.
export const authClient = createAuthClient()

// Auth calls return failures as `{ error }`, but throw when the request itself
// fails, such as when offline. This returns those as `{ error }` too, so
// callers handle both in one place.
export function settled<T>(request: Promise<T>) {
  return request.catch(() => ({
    data: null,
    error: { code: undefined as string | undefined },
  }))
}

// Sends the browser to Google, then back to `returnTo` on this site.
export async function signInWithGoogle(returnTo: string) {
  const { error } = await settled(
    authClient.signIn.social({ provider: 'google', callbackURL: returnTo }),
  )
  if (error) toast.error('Google sign-in couldn’t start. Try again.')
}
