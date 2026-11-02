import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'

import {
  CityContactCard,
  hasContactCardContent,
} from '#/components/CityContactCard'
import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { SearchModal } from '#/components/SearchModal'
import { useCityContacts } from '#/lib/contacts/use-city-contacts'
import { formatCity } from '#/lib/location/format'
import type { City } from '#/lib/location/types'

interface ResultsPageProps {
  // Absent on /results with no search, which shows a prompt instead.
  search?: { city: { name: string; region: string }; permit: string }
  resultCount?: number
  // Shown under the heading, such as when a saved search was run.
  meta?: ReactNode
  children?: ReactNode
}

// The results page frame: header with New search, the results column, and the
// city contact card beside it on large screens.
export function ResultsPage({
  search,
  resultCount,
  meta,
  children,
}: ResultsPageProps) {
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { contacts, isLoading: isLoadingContacts } = useCityContacts(
    search?.city.name ?? '',
    search?.city.region ?? '',
  )
  const showContacts = isLoadingContacts || hasContactCardContent(contacts)
  const initialCity: City | undefined = search && {
    ...search.city,
    country: 'United States',
  }

  function searchAgain(city: City, permit: string) {
    setIsModalOpen(false)
    void navigate({
      to: '/results',
      search: { city: city.name, region: city.region ?? '', permit },
    })
  }

  return (
    <main className="relative min-h-screen">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[linear-gradient(to_right,#302d2d0a_1px,transparent_1px),linear-gradient(to_bottom,#302d2d0a_1px,transparent_1px)] bg-[size:32px_32px]"
      />

      <header className="sticky top-0 z-40 border-b border-[#302d2d] bg-[#fdfff1] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4">
          <Link
            to="/"
            aria-label="Permit Search home"
            className="flex items-center gap-3 text-[#302d2d]"
          >
            <PermitSearchLogo className="size-9" />
            <span className="hidden text-base font-medium tracking-tight sm:block">
              Permit Search
            </span>
          </Link>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-[#1968b4] px-4 py-2 text-sm font-medium text-[#fdfff1] transition hover:bg-[#145390] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1968b4]"
            onClick={() => setIsModalOpen(true)}
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            New search
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6">
        {!search ? (
          <div className="mx-auto max-w-[780px] border-y border-[#302d2d] bg-[#fdfff1] py-10 text-center">
            <h1 className="text-2xl font-medium tracking-[-0.02em] text-[#302d2d]">
              Start a permit search
            </h1>
            <p className="mt-2 text-sm text-[#302d2d]/70">
              Choose a city and describe the work you’re planning.
            </p>
            <button
              type="button"
              className="mt-5 inline-flex items-center rounded-full bg-[#1968b4] px-5 py-2.5 text-sm font-medium text-[#fdfff1] transition hover:bg-[#145390]"
              onClick={() => setIsModalOpen(true)}
            >
              Search
            </button>
          </div>
        ) : (
          <section
            aria-live="polite"
            className={
              showContacts
                ? 'border-y border-[#302d2d] bg-[#fdfff1] py-7 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-x-10'
                : 'mx-auto max-w-[780px] border-y border-[#302d2d] bg-[#fdfff1] py-7'
            }
          >
            <div className="flex items-end justify-between gap-4 lg:col-start-1 lg:row-start-1">
              <div>
                <p className="text-xs font-medium tracking-[0.16em] text-[#1968b4] uppercase">
                  Permit sources
                </p>
                <h1 className="mt-1 text-2xl leading-tight font-medium tracking-[-0.02em] text-[#302d2d]">
                  {search.permit} in {formatCity(search.city)}
                </h1>
                {meta && (
                  <p className="mt-1 text-sm text-[#302d2d]/70">{meta}</p>
                )}
              </div>
              {resultCount !== undefined && (
                <span className="shrink-0 text-sm text-[#302d2d]/60">
                  {resultCount} {resultCount === 1 ? 'result' : 'results'}
                </span>
              )}
            </div>

            {showContacts && (
              // Beside the results on large screens, under the heading on phones.
              <aside className="mt-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
                <CityContactCard
                  contacts={contacts}
                  isLoading={isLoadingContacts}
                />
              </aside>
            )}

            <div className="lg:col-start-1 lg:row-start-2">{children}</div>
          </section>
        )}

        <p className="mt-7 text-center text-sm leading-5 text-[#302d2d]/60">
          Always confirm final requirements with your local permitting office.
        </p>
      </div>

      <SearchModal
        isOpen={isModalOpen}
        initialCity={initialCity}
        initialPermit={search?.permit}
        onClose={() => setIsModalOpen(false)}
        onSearch={searchAgain}
      />
    </main>
  )
}
