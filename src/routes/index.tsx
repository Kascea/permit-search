import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { PermitSearchForm } from '#/components/PermitSearchForm'
import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { SiteFooter } from '#/components/SiteFooter'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="w-full max-w-[780px]">
          <div className="mb-10 text-center">
            <a
              href="/"
              aria-label="Permit Search home"
              className="inline-flex items-center gap-3 text-left text-ink"
            >
              <PermitSearchLogo />
              <span>
                <span className="block text-[0.65rem] font-medium tracking-[0.2em] uppercase">
                  City services
                </span>
                <span className="block text-base font-medium tracking-tight">
                  Permit Search
                </span>
              </span>
            </a>
            <h1 className="mt-10 text-[clamp(3rem,9vw,5.75rem)] leading-[0.92] font-medium tracking-[-0.055em] text-ink">
              Find your city permit.
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-lg leading-6 font-medium text-ink">
              Select your city and describe the work you’re planning.
            </p>
          </div>

          <PermitSearchForm
            onSearch={(city, permit) =>
              navigate({
                to: '/results',
                search: {
                  city: city.name,
                  region: city.region ?? '',
                  permit,
                },
              })
            }
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
