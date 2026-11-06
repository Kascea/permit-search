import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { AccountMenu } from '#/components/AccountMenu'
import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { SearchModal } from '#/components/SearchModal'
import { formatCity } from '#/lib/location/format'
import { searchLabel } from '#/lib/navigation/origin'
import { useHasAppSidebar } from '#/lib/navigation/sidebar'
import type { City } from '#/lib/location/types'
import {
  clearCurrentSearch,
  useCurrentSearch,
} from '#/lib/search/current-search'

interface SiteHeaderProps {
  // A search for this page, such as a project's city, used only while the
  // user has no current search (see current-search.ts) and before the
  // browser has read it.
  search?: { city: { name: string; region: string }; permit: string }
  // Pass both to open the search modal from the page as well, such as from an
  // empty state's "Start searching" button.
  isSearchOpen?: boolean
  onSearchOpenChange?: (isOpen: boolean) => void
}

// On every page: the search pill on the right shows the current search,
// the same on every page until cleared, and opens the search modal. From lg
// up, beside AppSidebar, it's the top bar: the logo and account move to the
// sidebar, the search pill grows, and the bar is two grid cells tall so its
// rule (rule-b) lands on a grid line and runs on into the sidebar's.
export function SiteHeader({
  search,
  isSearchOpen: controlledIsOpen,
  onSearchOpenChange,
}: SiteHeaderProps) {
  const navigate = useNavigate()
  const hasSidebar = useHasAppSidebar()
  const [ownIsOpen, setOwnIsOpen] = useState(false)
  const isSearchOpen = controlledIsOpen ?? ownIsOpen
  const setIsSearchOpen = onSearchOpenChange ?? setOwnIsOpen
  const currentSearch = useCurrentSearch()
  const shown = currentSearch ?? search

  function runSearch(city: City, permit: string) {
    setIsSearchOpen(false)
    void navigate({
      to: '/search/results',
      search: { city: city.name, region: city.region ?? '', permit },
    })
  }

  return (
    <>
      <header
        className={`sticky top-0 z-40 bg-sheet px-4 rule-b sm:px-6 ${
          hasSidebar ? 'lg:px-8' : ''
        }`}
      >
        <div
          className={`mx-auto flex h-14 max-w-280 items-center gap-4 ${
            hasSidebar ? 'lg:h-16 lg:max-w-none' : ''
          }`}
        >
          <Link
            to="/"
            aria-label="Permit Search home"
            className={`flex shrink-0 items-center gap-2.5 text-ink ${
              hasSidebar ? 'lg:hidden' : ''
            }`}
          >
            <PermitSearchLogo className="size-7" />
            <span className="hidden text-sm font-medium tracking-tight sm:block">
              Permit Search
            </span>
          </Link>

          <div
            className={`relative ml-auto w-full max-w-75 min-w-0 ${
              hasSidebar ? 'lg:w-96 lg:max-w-none' : ''
            }`}
          >
            <button
              type="button"
              aria-label={
                shown
                  ? `Search: ${searchLabel(shown)}. Change search`
                  : 'New search'
              }
              className={`group flex w-full items-center gap-2 rounded-full border border-ink py-1 pr-1 pl-3 text-left text-sm transition hover:shadow-[0_2px_0_var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint ${
                hasSidebar ? 'lg:h-10 lg:pl-4' : ''
              }`}
              onClick={() => setIsSearchOpen(true)}
            >
              <svg
                aria-hidden="true"
                className="size-4 shrink-0 text-ink/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                />
              </svg>
              {/* Room on the right for the clear button. */}
              <span
                className={`min-w-0 flex-1 truncate ${
                  currentSearch ? 'pr-6' : ''
                }`}
              >
                {shown ? (
                  <>
                    <span className="font-medium text-ink">
                      {formatCity(shown.city)}
                    </span>
                    {shown.permit && (
                      <span className="text-ink/60"> · {shown.permit}</span>
                    )}
                  </>
                ) : (
                  <span className="text-ink/60">Search for a permit</span>
                )}
              </span>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blueprint text-paper transition group-hover:bg-blueprint-deep">
                <svg
                  aria-hidden="true"
                  className="size-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="m20 20-3.5-3.5" />
                </svg>
              </span>
            </button>

            {/* Beside the search button rather than in it, as buttons
                can't nest. */}
            {currentSearch && (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                className="absolute top-1/2 right-9 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink/50 transition hover:bg-ink/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-blueprint"
                onClick={clearCurrentSearch}
              >
                <svg
                  aria-hidden="true"
                  className="size-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>

          <div className={hasSidebar ? 'lg:hidden' : ''}>
            <AccountMenu />
          </div>
        </div>
      </header>

      <SearchModal
        isOpen={isSearchOpen}
        initialCity={shown && { ...shown.city, country: 'United States' }}
        initialPermit={shown?.permit}
        onClose={() => setIsSearchOpen(false)}
        onSearch={runSearch}
      />
    </>
  )
}
