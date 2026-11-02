import { Link } from '@tanstack/react-router'

import { CONTACT_EMAIL } from '#/lib/site'

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-ink px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-ink/60">
        <p>
          © {new Date().getFullYear()} Permit Search · Always confirm
          requirements with your local permitting office.
        </p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link className="hover:text-blueprint" to="/about">
            About
          </Link>
          <a className="hover:text-blueprint" href={`mailto:${CONTACT_EMAIL}`}>
            Contact us
          </a>
        </nav>
      </div>
    </footer>
  )
}
