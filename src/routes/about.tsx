import { Link, createFileRoute } from '@tanstack/react-router'

import { SiteFooter } from '#/components/SiteFooter'
import { SiteHeader } from '#/components/SiteHeader'
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
    body: 'We search for the pages and forms that cover your project, and mark the ones from government sites. If nothing covers it directly, we show the city’s general permit pages.',
  },
  {
    title: 'Open, call, or fill out',
    body: 'Go straight to each source, reach the city permit office from its contact card, or fill out PDF forms in the editor.',
  },
]

function About() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 sm:px-6">
        <article className="mx-auto max-w-[780px] border-b border-ink bg-paper/50 py-8">
          <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
            About
          </p>
          <h1 className="mt-1 text-2xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-3xl">
            Permit Search finds the official permit pages for your project.
          </h1>
          <p className="mt-4 text-sm leading-6 text-ink/70">
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
                  <span className="mt-1 block text-sm leading-6 text-ink/70">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <h2 className="mt-8 border-t border-ink pt-5 text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
            Good to know
          </h2>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-ink/70">
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
      </main>

      <SiteFooter />
    </div>
  )
}
