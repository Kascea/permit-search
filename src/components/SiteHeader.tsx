import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { AccountMenu } from '#/components/AccountMenu'
import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { SearchModal } from '#/components/SearchModal'
import { formatCity } from '#/lib/location/format'
import type { City } from '#/lib/location/types'

// Page links beside the logo. Add more here.
const NAV_LINKS = [{ to: '/about', label: 'About' }] as const

interface SiteHeaderProps {
  // The page's current search, if any. Its city shows in the search pill, and
  // the search modal starts from it.
  search?: { city: { name: string; region: string }; permit: string }
}

// On every page but home: the search pill on the right opens the search modal.
export function SiteHeader({ search }: SiteHeaderProps) {
  const navigate = useNavigate()
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  function runSearch(city: City, permit: string) {
    setIsSearchOpen(false)
    void navigate({
      to: '/results',
      search: { city: city.name, region: city.region ?? '', permit },
    })
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink bg-paper px-4 sm:px-6">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-4">
          <Link
            to="/"
            aria-label="Permit Search home"
            className="flex shrink-0 items-center gap-2.5 text-ink"
          >
            <PermitSearchLogo className="size-7" />
            <span className="hidden text-sm font-medium tracking-tight sm:block">
              Permit Search
            </span>
          </Link>

          <span aria-hidden="true" className="h-5 w-px bg-ink/20" />

          <nav aria-label="Main" className="flex items-center gap-5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm text-ink/70 transition hover:text-ink"
                activeProps={{ className: 'font-medium text-blueprint' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            aria-label={
              search
                ? `City: ${formatCity(search.city)}. New search`
                : 'New search'
            }
            className="group ml-auto flex max-w-[300px] min-w-0 items-center gap-2 rounded-full border border-ink py-1 pr-1 pl-3 text-left text-sm transition hover:shadow-[0_2px_0_var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint"
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
            <span
              className={`min-w-0 flex-1 truncate ${
                search ? 'font-medium text-ink' : 'text-ink/60'
              }`}
            >
              {search ? formatCity(search.city) : 'Search for a permit'}
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

          <AccountMenu />
        </div>
      </header>

      <SearchModal
        isOpen={isSearchOpen}
        initialCity={search && { ...search.city, country: 'United States' }}
        initialPermit={search?.permit}
        onClose={() => setIsSearchOpen(false)}
        onSearch={runSearch}
      />
    </>
  )
}
