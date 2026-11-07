import { Link } from '@tanstack/react-router'

import { SIGN_IN_REASON } from '#/components/AboutSections'
import { primaryButtonClass } from '#/components/buttons'
import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { SignInButton } from '#/components/SignInDialog'
import { useAuth } from '#/lib/auth/use-auth'

const linkClass =
  'shrink-0 text-sm font-medium text-ink underline-offset-2 hover:text-blueprint hover:underline'

// The header of the pages about the site, the home page and About: the logo, and
// the way into the app. Only the button changes with sign-in.
export function SiteTopBar() {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-40 bg-sheet px-4 rule-b sm:px-6">
      <div className="mx-auto flex h-14 max-w-280 items-center gap-4">
        <Link
          to="/"
          aria-label="Permit Search home"
          className="mr-auto flex items-center gap-2.5 text-sm font-medium tracking-tight text-ink"
        >
          <PermitSearchLogo className="size-7" />
          <span className="hidden min-[28rem]:block">Permit Search</span>
        </Link>
        <Link to="/about" className={linkClass}>
          About
        </Link>
        <Link to="/drafts" className={linkClass}>
          Your drafts
        </Link>
        {user ? (
          <Link to="/dashboard" className={primaryButtonClass}>
            Dashboard
          </Link>
        ) : (
          <SignInButton
            className={primaryButtonClass}
            reason={SIGN_IN_REASON}
          />
        )}
      </div>
    </header>
  )
}
