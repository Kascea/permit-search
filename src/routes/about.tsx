import { Link, createFileRoute } from '@tanstack/react-router'

import { AppPage } from '#/components/AppPage'
import { PERMIT_PROVIDERS } from '#/lib/portals/providers'
import type { ProviderCapabilities } from '#/lib/portals/providers'
import { CONTACT_EMAIL } from '#/lib/site'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [{ title: 'About | Permit Search' }],
  }),
  component: About,
})

const STEPS = [
  {
    title: 'Tell us where and what',
    body: 'Choose your city and describe the work you’re planning, such as a new deck or a bathroom remodel.',
  },
  {
    title: 'We find the official sources',
    body: 'In cities on a supported permit portal, we start with the city’s own online permits that fit your project. Everywhere, we search for the pages and forms that cover it, and mark the ones from government sites.',
  },
  {
    title: 'Apply, fill out, and track',
    body: 'Apply on the city’s portal or fill out PDF forms in the editor, then add the permit number to your project to follow its status.',
  },
]

function About() {
  return (
    <AppPage>
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

        <h2 className="mt-10 border-t border-ink pt-5 text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
          How it works
        </h2>
        <ol className="mt-2 divide-y divide-ink/20">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4 py-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-ink text-xs font-medium text-ink">
                {index + 1}
              </span>
              <span>
                <span className="block font-medium text-ink">
                  {step.title}
                </span>
                <span className="mt-1 block text-base leading-6 text-ink/70">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>

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

        <Link
          to="/"
          className="mt-8 inline-flex items-center rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint"
        >
          Start a search
        </Link>
      </article>
    </AppPage>
  )
}

// What each provider's capabilities mean for a visitor, in display order.
const CAPABILITY_LABELS: Array<[keyof ProviderCapabilities, string]> = [
  ['catalog', 'Finds the city’s online permits'],
  ['statusLookup', 'Tracks permit status'],
  ['submission', 'Submits applications'],
]

// The permit portals Permit Search works with, and their cities, from the
// provider registry: adding a provider lists it here.
function SupportedPortals() {
  const providers = Object.values(PERMIT_PROVIDERS)

  return (
    <>
      <h2 className="mt-8 border-t border-ink pt-5 text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
        Supported permit portals
      </h2>
      <p className="mt-2 text-base leading-6 text-ink/70">
        In these cities, Permit Search reads the city’s permit portal directly.
        Everywhere else, it searches the city’s website.
      </p>
      <ul className="mt-2 divide-y divide-ink/20">
        {providers.map((provider) => (
          <li key={provider.name} className="py-4">
            <p className="font-medium text-ink">{provider.name}</p>
            <p className="mt-1 text-base leading-6 text-ink/70">
              {provider.description}
            </p>
            <p className="mt-2 flex flex-wrap gap-1.5">
              {CAPABILITY_LABELS.flatMap(([key, label]) =>
                provider.capabilities[key]
                  ? [
                      <span
                        key={key}
                        className="rounded-full bg-blueprint/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-blueprint uppercase"
                      >
                        {label}
                      </span>,
                    ]
                  : [],
              )}
            </p>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              {provider.jurisdictions
                .map((jurisdiction) => jurisdiction.city.name)
                .sort((a, b) => a.localeCompare(b))
                .join(', ')}
              {', '}
              {provider.jurisdictions[0]?.city.region}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
