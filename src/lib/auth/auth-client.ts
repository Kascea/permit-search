import { createAuthClient } from 'better-auth/react'

// Same origin as the site, so no baseURL is needed.
export const authClient = createAuthClient()

// Sends the browser to Google, then back to `returnTo` on this site.
export function signInWithGoogle(returnTo: string) {
  return authClient.signIn.social({ provider: 'google', callbackURL: returnTo })
}
