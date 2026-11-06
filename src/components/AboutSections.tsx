import { PERMIT_PROVIDERS } from '#/lib/portals/providers'
import type { ProviderCapabilities } from '#/lib/portals/providers'

// What the site does, on both the About page and the signed-out home page.

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

export function HowItWorks() {
  return (
    <>
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
              <span className="block font-medium text-ink">{step.title}</span>
              <span className="mt-1 block text-base leading-6 text-ink/70">
                {step.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </>
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
export function SupportedPortals() {
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
