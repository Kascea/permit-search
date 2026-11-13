import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import {
  CreateAccountPrompt,
  HowItWorks,
  WhoItsFor,
} from '#/components/AboutSections'
import { AppPage } from '#/components/AppPage'
import { PermitSearchForm } from '#/components/PermitSearchForm'
import { SiteFooter } from '#/components/SiteFooter'
import { SiteTopBar } from '#/components/SiteTopBar'
import { useAuth } from '#/lib/auth/use-auth'
import { searchPageTarget } from '#/lib/search/pending-search'
import { CONTACT_EMAIL, SITE_URL } from '#/lib/site'

const HOME_TITLE = 'Permit Search | Find local permit requirements'

const HOME_DESCRIPTION =
  'Find your city’s official permit pages and forms for home improvement and construction projects, fill out PDF forms, and track your permit’s status.'

// The site's front door, the same page for everyone and rendered on the server.
// The signed-in app starts at /dashboard, which the top bar links to.
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: 'description', content: HOME_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Permit Search' },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:title', content: HOME_TITLE },
      { property: 'og:description', content: HOME_DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: SITE_URL }],
  }),
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <AppPage topBar={<SiteTopBar />} footer={<SiteFooter />}>
      <div className="mb-10 text-center">
        <p className="mb-4 text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
          For homeowners and contractors
        </p>
        <h1 className="text-[clamp(3rem,9vw,5.5rem)] leading-[1] font-medium tracking-[-0.04em] text-ink">
          Find your city permit.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-6 font-medium text-ink">
          Tell us your city and the work you’re planning. We’ll find the
          official pages and forms, then help you fill them out.
        </p>
      </div>

      <PermitSearchForm
        onSearch={(city, permit) =>
          navigate(
            searchPageTarget({
              city: { name: city.name, region: city.region ?? '' },
              permit,
            }),
          )
        }
      />

      {!user && (
        <p className="mt-4 text-center text-sm text-ink/70">
          No account needed to search.
        </p>
      )}

      <WhoItsFor />
      <HowItWorks />
      <CreateAccountPrompt />

      <p className="mt-8 border-t border-ink pt-5 text-base leading-6 text-ink/70">
        Permit Search points you to official sources but isn’t one. Requirements
        change, so always confirm with your local permitting office before you
        start work. Questions?{' '}
        <Link
          to="/about"
          className="font-medium text-blueprint underline-offset-2 hover:underline"
        >
          Read more about us
        </Link>{' '}
        or{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-medium text-blueprint underline-offset-2 hover:underline"
        >
          email us
        </a>
        .
      </p>
    </AppPage>
  )
}
