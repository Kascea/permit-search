import { useEffect } from 'react'
import { toast } from 'sonner'

// Better Auth sends a failed Google sign-in back to the page it started from
// with ?error=<code> (see signInWithGoogle). This turns the code into a
// message, then drops it from the address so a reload doesn't show it again.
export function OAuthErrorToast() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('error')

    if (!code) return

    url.searchParams.delete('error')
    url.searchParams.delete('error_description')
    window.history.replaceState(window.history.state, '', url)

    const message = oauthErrorMessage(code)

    if (message) toast.error(message)
  }, [])

  return null
}

function oauthErrorMessage(code: string) {
  switch (code) {
    // Better Auth links Google only to an account whose email is verified,
    // and there's no email verification yet.
    case 'account_not_linked':
      return 'This email already has an account. Sign in with your email and password instead.'
    // They closed or cancelled Google's screen.
    case 'access_denied':
      return undefined
    default:
      return 'Google sign-in didn’t work. Try again.'
  }
}
