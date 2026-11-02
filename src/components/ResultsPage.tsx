import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { CityContactCard } from '#/components/CityContactCard'
import { ReportDialog } from '#/components/ReportDialog'
import { SiteFooter } from '#/components/SiteFooter'
import { SiteHeader } from '#/components/SiteHeader'
import { useCityContacts } from '#/lib/contacts/use-city-contacts'
import { formatCity } from '#/lib/location/format'

interface ResultsPageProps {
  // Absent on /results with no search, which shows a prompt instead.
  search?: { city: { name: string; region: string }; permit: string }
  resultCount?: number
  // Shown under the heading, such as whether the results were reused.
  meta?: ReactNode
  // A saved search's public ID, so visitors can report it as incorrect.
  searchId?: string
  children?: ReactNode
}

// The results page frame: header with the current search, the results column,
// and the city contact card beside it on large screens.
export function ResultsPage({
  search,
  resultCount,
  meta,
  searchId,
  children,
}: ResultsPageProps) {
  const [isReportOpen, setIsReportOpen] = useState(false)
  const contacts = useCityContacts(
    search?.city.name ?? '',
    search?.city.region ?? '',
  )
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={search} />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 sm:px-6">
        {!search ? (
          <div className="mx-auto max-w-[780px] border-b border-ink bg-paper/85 py-10 text-center">
            <h1 className="text-2xl font-medium tracking-[-0.02em] text-ink">
              Start a permit search
            </h1>
            <p className="mt-2 text-sm text-ink/70">
              Choose a city and describe the work you’re planning.
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex items-center rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
            >
              Search
            </Link>
          </div>
        ) : (
          // Always two columns on large screens, so the page doesn't shift
          // when the contact card arrives.
          <section
            aria-live="polite"
            className="bg-paper/50 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-x-10"
          >
            <div className="flex items-end justify-between gap-4 lg:col-start-1 lg:row-start-1">
              <div>
                <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
                  Permit sources
                </p>
                <h1 className="mt-1 text-xl leading-tight sm:text-2xl font-medium tracking-[-0.02em] text-ink">
                  {search.permit} in {formatCity(search.city)}
                </h1>
                {meta && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink/70">
                    {meta}
                  </div>
                )}
              </div>
              {resultCount !== undefined && (
                <span className="shrink-0 text-sm text-ink/60">
                  {resultCount} {resultCount === 1 ? 'result' : 'results'}
                </span>
              )}
            </div>

            {/* Beside the results on large screens, under the heading on phones. */}
            <aside className="mt-6 empty:hidden lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
              <CityContactCard contacts={contacts} />
            </aside>

            <div className="lg:col-start-1 lg:row-start-2">
              {children}
              {searchId && (
                <p className="mt-2 border-t border-ink/20 pt-4 text-sm text-ink/70">
                  Something look wrong?{' '}
                  <button
                    type="button"
                    className="font-medium text-blueprint underline-offset-2 hover:underline"
                    onClick={() => setIsReportOpen(true)}
                  >
                    Report incorrect results
                  </button>
                </p>
              )}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />

      {searchId && (
        <ReportDialog
          isOpen={isReportOpen}
          searchId={searchId}
          onClose={() => setIsReportOpen(false)}
        />
      )}
    </div>
  )
}
