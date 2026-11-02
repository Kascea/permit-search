import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { PermitSearchForm } from '#/components/PermitSearchForm'
import { PermitSearchLogo } from '#/components/PermitSearchLogo'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 sm:py-16">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[linear-gradient(to_right,#302d2d0a_1px,transparent_1px),linear-gradient(to_bottom,#302d2d0a_1px,transparent_1px)] bg-[size:32px_32px]"
      />

      <div className="w-full max-w-[780px]">
        <div className="mb-10 text-center">
          <a
            href="/"
            aria-label="Permit Search home"
            className="inline-flex items-center gap-3 text-left text-[#302d2d]"
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
          <h1 className="mt-10 text-[clamp(3rem,9vw,5.75rem)] leading-[0.92] font-medium tracking-[-0.055em] text-[#302d2d]">
            Find your city permit.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-6 font-medium text-[#302d2d]">
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

        <p className="mt-7 text-center text-sm leading-5 text-[#302d2d]/60">
          Always confirm final requirements with your local permitting office.
        </p>
      </div>
    </main>
  )
}
