import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { HowItWorks, SupportedPortals } from '#/components/AboutSections'
import { AppPage } from '#/components/AppPage'
import { primaryButtonClass } from '#/components/buttons'
import { CONTACT_EMAIL } from '#/lib/site'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [{ title: 'About | Permit Search' }],
  }),
  component: About,
})

function About() {
  // The header owns the search modal; the button below opens it too.
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return (
    <AppPage isSearchOpen={isSearchOpen} onSearchOpenChange={setIsSearchOpen}>
      <article className="border-b border-ink bg-paper/50 pb-8">
        <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
          About
        </p>
        <h1 className="mt-1 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
          Permit Search finds the official permit pages for your project.
        </h1>
        <p className="mt-4 text-base leading-6 text-ink/70">
          Every city publishes its permit rules differently, often spread
          across several departments. Permit Search brings the right pages
          together in one place, so you can see what your project needs before
          you call or apply.
        </p>

        <HowItWorks />

        <SupportedPortals />

        <h2 className="mt-8 border-t border-ink pt-5 text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
          Good to know
        </h2>
        <ul className="mt-3 space-y-3 text-base leading-6 text-ink/70">
          <li>
            Results are saved, so a search link always shows the same results
            and can be shared with a contractor or neighbor.
          </li>
          <li>
            Permit Search points you to official sources but isn’t one.
            Requirements change, so always confirm with your local permitting
            office before you start work.
          </li>
          <li>
            Questions or feedback?{' '}
            <a
              className="font-medium text-blueprint underline-offset-2 hover:underline"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              Email us
            </a>
            .
          </li>
        </ul>

        <button
          type="button"
          className={`mt-8 ${primaryButtonClass}`}
          onClick={() => setIsSearchOpen(true)}
        >
          Start a search
        </button>
      </article>
    </AppPage>
  )
}
