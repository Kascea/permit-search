import { Link } from '@tanstack/react-router'

import { rowPrimaryButtonClass } from '#/components/buttons'
import { SignInButton } from '#/components/SignInDialog'
import { useAuth } from '#/lib/auth/use-auth'
import { PERMIT_PROVIDERS } from '#/lib/portals/providers'
import type { ProviderCapabilities } from '#/lib/portals/providers'
import { CONTACT_EMAIL } from '#/lib/site'

// Shown when signing in or creating an account from the home page. The
// dialog switches between the two, so it has to read right for both.
export const SIGN_IN_REASON =
  'Keep your projects, forms and permits in one place.'

const AUDIENCES = [
  {
    title: 'Homeowners',
    body: 'Planning a deck, a new roof or a remodel? See which permit pages and forms cover the work, without digging through your city’s website.',
  },
  {
    title: 'Contractors and builders',
    body: 'Working in more than one city? Find each city’s forms in one place, and enter a job’s details once to autofill them.',
  },
]

// The smaller things a visitor can do straight away, and what an account adds,
// on top of FEATURES. The second list is what's gated, so keep it in step with
// the sign-in checks.
const WITHOUT_ACCOUNT = [
  'Find your city’s permit pages and forms',
  'Share your results with a link',
  'See who to contact at the city',
]

const WITH_ACCOUNT = [
  'Save permits to reuse, and keep a history of your searches',
  'Track a permit’s status in supported cities',
  'Keep your drafts in your account and open them anywhere',
]

// Keep needsAccount in step with the sign-in checks.
const FEATURES = [
  {
    title: 'Built-in PDF editor',
    needsAccount: false,
    body: 'Fill out your city’s PDF forms right here, with nothing to print or install. Type into the form, add text, check marks, dates and your signature anywhere on the page, then download the finished PDF.',
  },
  {
    title: 'Autofill with AI',
    needsAccount: true,
    body: 'Enter a job’s address, owner, contractor and work once, in a project. Autofill matches those details to the form’s empty boxes, using AI to read the page when the match isn’t obvious. It fills only the clear matches, shows you everything it filled, and can be undone.',
  },
  {
    title: 'Form check with AI',
    needsAccount: true,
    body: 'Before you submit, check the form for likely mistakes, anything missing and entries worth a second look, such as a wrong kind of answer, details that disagree with your project, a vague work description or a missing signature. Each finding links to its field.',
  },
]

// The sections under the heroes, rendered on the server so search engines read
// them. The home page has WhoItsFor and HowItWorks, and About has the rest, so
// nothing is said twice.

export function WhoItsFor() {
  return (
    <>
      <h2 className="mt-10 border-t border-ink pt-5 text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
        Who it’s for
      </h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 sm:gap-8">
        {AUDIENCES.map((audience) => (
          <div key={audience.title}>
            <h3 className="font-medium text-ink">{audience.title}</h3>
            <p className="mt-1 text-base leading-6 text-ink/70">
              {audience.body}
            </p>
          </div>
        ))}
      </div>
    </>
  )
}

export function Features() {
  return (
    <>
      <h2 className="mt-8 border-t border-ink pt-5 text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
        What’s built in
      </h2>
      <ul className="mt-2 divide-y divide-ink/20">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-lg leading-6 font-medium text-ink">
                {feature.title}
              </h3>
              <span className="rounded-full bg-blueprint/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-blueprint uppercase">
                {feature.needsAccount ? 'With an account' : 'No account needed'}
              </span>
            </div>
            <p className="mt-1 text-base leading-6 text-ink/70">
              {feature.body}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}

function CreateAccountButton({ className = '' }: { className?: string }) {
  return (
    <SignInButton
      className={`${className} ${rowPrimaryButtonClass}`}
      initialMode="sign-up"
      reason={SIGN_IN_REASON}
    >
      Create an account
    </SignInButton>
  )
}

// The home page's way to sign up, for visitors only.
export function CreateAccountPrompt() {
  const { user } = useAuth()

  if (user) return null

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-ink pt-5">
      <p className="text-base leading-6 text-ink/70">{SIGN_IN_REASON}</p>
      <CreateAccountButton />
    </div>
  )
}

export function WhatYouCanDo() {
  const { user } = useAuth()

  return (
    <>
      <h2 className="mt-8 border-t border-ink pt-5 text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
        What else you can do
      </h2>
      <div className="mt-4 grid gap-8 sm:grid-cols-2">
        <div>
          <FeatureList title="No account needed" items={WITHOUT_ACCOUNT} />
        </div>
        <div>
          <FeatureList
            title={user ? 'With your account' : 'With an account'}
            items={WITH_ACCOUNT}
          />
          {!user && <CreateAccountButton className="mt-5" />}
        </div>
      </div>
    </>
  )
}

// The rest of the About page.
export function GoodToKnow() {
  return (
    <>
      <h2 className="mt-8 border-t border-ink pt-5 text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
        Good to know
      </h2>
      <ul className="mt-3 space-y-3 text-base leading-6 text-ink/70">
        <li>
          Every search has its own link, which always shows the newest results
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
        <li>
          Read our{' '}
          <Link
            className="font-medium text-blueprint underline-offset-2 hover:underline"
            to="/terms"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            className="font-medium text-blueprint underline-offset-2 hover:underline"
            to="/privacy"
          >
            Privacy Policy
          </Link>
          .
        </li>
      </ul>
    </>
  )
}

function FeatureList({
  title,
  items,
}: {
  title: string
  items: Array<string>
}) {
  return (
    <>
      <h3 className="font-medium text-ink">{title}</h3>
      <ul className="mt-2 divide-y divide-ink/20">
        {items.map((item) => (
          <li key={item} className="py-2 text-base leading-6 text-ink/70">
            {item}
          </li>
        ))}
      </ul>
    </>
  )
}

const STEPS = [
  {
    title: 'Tell us where and what',
    body: 'Choose your city and describe the work you’re planning, such as a new deck or a bathroom remodel.',
  },
  {
    title: 'We find the official sources',
    body: 'You get your city’s official pages and forms, with the ones from government sites marked.',
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
