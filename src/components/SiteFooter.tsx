import { Link } from '@tanstack/react-router'

import { CONTACT_EMAIL } from '#/lib/site'

const linkClass = 'underline-offset-2 hover:text-ink hover:underline'

// The foot of the pages about the site. Google's OAuth branding rules want the
// privacy policy and terms linked from the home page.
export function SiteFooter() {
  return (
    <footer className="border-t border-ink px-4 sm:px-6">
      <div className="mx-auto flex max-w-280 min-h-16 flex-wrap items-center gap-x-6 gap-y-2 py-4 text-sm text-ink/60">
        <span className="mr-auto">© {new Date().getFullYear()} Permit Search</span>
        <Link to="/terms" className={linkClass}>
          Terms
        </Link>
        <Link to="/privacy" className={linkClass}>
          Privacy
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
          Contact
        </a>
      </div>
    </footer>
  )
}
