import { Link } from '@tanstack/react-router'

import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { useAuth } from '#/lib/auth/use-auth'
import { CONTACT_EMAIL } from '#/lib/site'

// A slim blue strip at the bottom of every page but the editor. Signed in,
// AppSidebar carries its links from lg up, so the page is all canvas there.
export function SiteFooter() {
  const { user } = useAuth()

  return (
    <footer
      className={`mt-16 bg-blueprint px-4 py-3 text-paper sm:px-6 ${
        user ? 'lg:hidden' : ''
      }`}
    >
      <div className="mx-auto flex max-w-280 flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-2.5">
          <PermitSearchLogo className="size-5 shrink-0" />
          <p className="text-paper/70">
            © {new Date().getFullYear()} Permit Search · Always confirm
            requirements with your local permitting office.
          </p>
        </div>
        <nav aria-label="Footer" className="flex gap-4 font-medium">
          <Link className="transition-opacity hover:opacity-60" to="/about">
            About
          </Link>
          <a
            className="transition-opacity hover:opacity-60"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            Contact us
          </a>
        </nav>
      </div>
    </footer>
  )
}
