import { Link, createFileRoute } from '@tanstack/react-router'

import {
  Features,
  GoodToKnow,
  SupportedPortals,
  WhatYouCanDo,
} from '#/components/AboutSections'
import { AppPage } from '#/components/AppPage'
import { primaryButtonClass } from '#/components/buttons'
import { SiteFooter } from '#/components/SiteFooter'
import { SiteTopBar } from '#/components/SiteTopBar'
import { SITE_URL } from '#/lib/site'

const ABOUT_DESCRIPTION =
  'What Permit Search can do: a built-in PDF editor, autofill and form checks with AI, permit tracking, and the permit portals it supports.'

// The home page's top bar, then the detail the home page leaves out. Searching
// happens on the home page, so this one links there.
export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About | Permit Search' },
      { name: 'description', content: ABOUT_DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}about` }],
  }),
  component: About,
})

function About() {
  return (
    <AppPage topBar={<SiteTopBar />} footer={<SiteFooter />}>
      <div className="mb-10 text-center">
        <p className="mb-4 text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
          About Permit Search
        </p>
        <h1 className="text-[clamp(3rem,9vw,5.5rem)] leading-[1] font-medium tracking-[-0.04em] text-ink">
          Every city does permits differently.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-6 font-medium text-ink">
          Their rules are often spread across several departments. Permit Search
          brings the right pages together in one place, so you can see what your
          project needs before you call or apply.
        </p>
        <Link to="/" className={`mt-8 ${primaryButtonClass}`}>
          Start a search
        </Link>
      </div>

      <Features />
      <WhatYouCanDo />
      <SupportedPortals />
      <GoodToKnow />
    </AppPage>
  )
}
