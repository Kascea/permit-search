import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { CityCombobox } from '#/components/CityCombobox'
import { reverseGeocodeCity } from '#/lib/location/mapbox'
import type { City } from '#/lib/location/types'
import { searchPermits } from '#/lib/search/permit-search'
import type { PermitSearchResponse } from '#/lib/search/types'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
  const [cityInput, setCityInput] = useState('')
  const [selectedCity, setSelectedCity] = useState<City>()
  const [permitQuery, setPermitQuery] = useState('')
  const [formError, setFormError] = useState('')
  const [locationError, setLocationError] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchedFor, setSearchedFor] = useState('')
  const [searchResponse, setSearchResponse] = useState<PermitSearchResponse>()

  function updateCityInput(value: string) {
    setCityInput(value)
    setSelectedCity(undefined)
    setFormError('')
  }

  function selectCity(city: City) {
    setSelectedCity(city)
    setCityInput(formatCity(city))
    setFormError('')
    setLocationError('')
  }

  function useCurrentLocation() {
    setLocationError('')

    if (!mapboxToken) {
      setLocationError(
        'Add a Mapbox token to use your location, or enter a city.',
      )
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const city = await reverseGeocodeCity(
            coords.latitude,
            coords.longitude,
            mapboxToken,
          )
          selectCity(city)
        } catch (error) {
          setLocationError(
            error instanceof Error
              ? error.message
              : 'We could not determine your city.',
          )
        } finally {
          setIsLocating(false)
        }
      },
      (error) => {
        setIsLocating(false)
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location access was declined. Enter your city instead.'
            : 'Your location is unavailable. Enter your city instead.',
        )
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  async function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cityValue = cityInput.trim()
    const permitValue = permitQuery.trim()

    if (!cityValue || !permitValue) {
      setFormError('Enter a city and describe the permit you need.')
      return
    }

    const manualParts = cityValue.split(',').map((part) => part.trim())
    const city =
      selectedCity ??
      ({
        name: manualParts[0],
        region: manualParts[1],
        country: 'United States',
      } satisfies City)

    setFormError('')
    setSearchResponse(undefined)
    setIsSearching(true)

    try {
      const response = await searchPermits({
        data: { city, permit: permitValue },
      })
      setSearchedFor(`${permitValue} in ${formatCity(city)}`)
      setSearchResponse(response)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Permit search is temporarily unavailable.',
      )
    } finally {
      setIsSearching(false)
    }

    window.setTimeout(() => {
      document
        .getElementById('search-result')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

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
            <span className="grid size-10 place-items-center rounded-[2px] bg-[#302d2d] text-[#fdfff1]">
              <svg
                aria-hidden="true"
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 21h18M4.5 9h15M6 9v9m4-9v9m4-9v9m4-9v9M3.75 6 12 2.25 20.25 6v3H3.75V6Z"
                />
              </svg>
            </span>
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

        <div>
          <form
            className="border border-[#302d2d] bg-[#fdfff1] p-5 sm:p-6"
            noValidate
            onSubmit={submitSearch}
          >
            <div className="mb-8 flex items-center justify-between border-b border-[#302d2d] pb-5">
              <span className="text-sm font-medium text-[#302d2d]">
                Start your search
              </span>
              <span className="flex items-center gap-2 text-sm font-medium text-[#302d2d]/60">
                <span className="size-2 rounded-full bg-[#1968b4]" />
                Local lookup
              </span>
            </div>

            <CityCombobox
              accessToken={mapboxToken}
              selectedCity={selectedCity}
              value={cityInput}
              onChange={updateCityInput}
              onCitySelected={selectCity}
            />

            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#302d2d] px-4 py-2 text-sm font-medium text-[#302d2d] transition hover:bg-[#302d2d] hover:text-[#fdfff1] disabled:cursor-wait disabled:opacity-60"
              disabled={isLocating}
              onClick={useCurrentLocation}
            >
              {isLocating ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-[#1968b4]/20 border-t-[#1968b4]" />
              ) : (
                <svg
                  aria-hidden="true"
                  className="size-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c1.243 0 2.25-4.03 2.25-9S13.243 3 12 3s-2.25 4.03-2.25 9S10.757 21 12 21ZM3.6 9h16.8M3.6 15h16.8"
                  />
                </svg>
              )}
              {isLocating ? 'Finding your city…' : 'Detect my city'}
            </button>

            {locationError && (
              <p
                className="mt-2 text-sm font-medium text-amber-700"
                role="alert"
              >
                {locationError}
              </p>
            )}

            <div className="mt-7">
              <label
                className="mb-2 block text-sm font-medium text-[#302d2d]"
                htmlFor="permit-query"
              >
                Project or permit
              </label>
              <textarea
                id="permit-query"
                className="field-input min-h-24 resize-none"
                placeholder="e.g. Build a deck, replace a roof, add a bathroom"
                value={permitQuery}
                onChange={(event) => {
                  setPermitQuery(event.target.value)
                  setFormError('')
                }}
              />
            </div>

            {formError && (
              <p
                className="mt-4 border border-[#953012] bg-[#953012]/10 px-4 py-3 text-sm font-medium text-[#953012]"
                role="alert"
              >
                {formError}
              </p>
            )}

            <button
              type="submit"
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-[#1968b4] px-5 py-4 text-lg font-medium text-[#fdfff1] transition hover:bg-[#145390] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1968b4] disabled:cursor-wait disabled:opacity-70"
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-[#fdfff1]/35 border-t-[#fdfff1]" />
                  Searching official sources…
                </>
              ) : (
                <>
                  Find my permit
                  <svg
                    aria-hidden="true"
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m9 18 6-6-6-6"
                    />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        {searchResponse && (
          <section
            id="search-result"
            aria-live="polite"
            className="mt-8 border-y border-[#302d2d] bg-[#fdfff1] py-7"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-[0.16em] text-[#1968b4] uppercase">
                  Permit sources
                </p>
                <h2 className="mt-1 text-2xl leading-tight font-medium tracking-[-0.02em] text-[#302d2d]">
                  {searchedFor}
                </h2>
              </div>
              <span className="shrink-0 text-sm text-[#302d2d]/60">
                {searchResponse.results.length}{' '}
                {searchResponse.results.length === 1 ? 'result' : 'results'}
              </span>
            </div>

            {searchResponse.results.length > 0 ? (
              <ol className="mt-6 divide-y divide-[#302d2d]/20 border-t border-[#302d2d]">
                {searchResponse.results.map((searchResult) => (
                  <li key={searchResult.url}>
                    <a
                      className="group block py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1968b4]"
                      href={searchResult.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium tracking-[0.08em] text-[#302d2d]/60 uppercase">
                              {searchResult.domain}
                            </span>
                            {searchResult.isGovernmentSource && (
                              <span className="rounded-full bg-[#1968b4]/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-[#1968b4] uppercase">
                                Government
                              </span>
                            )}
                            {searchResult.url
                              .toLowerCase()
                              .endsWith('.pdf') && (
                              <span className="rounded-full bg-[#953012]/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-[#953012] uppercase">
                                PDF
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1 text-lg leading-6 font-medium text-[#302d2d] group-hover:text-[#1968b4]">
                            {searchResult.title}
                          </h3>
                          <p className="mt-1 break-all text-xs leading-5 text-[#1968b4]">
                            {searchResult.url}
                          </p>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#302d2d]/70">
                            {searchResult.description}
                          </p>
                        </div>
                        <svg
                          aria-hidden="true"
                          className="mt-1 size-4 shrink-0 text-[#302d2d]/50 transition group-hover:translate-x-0.5 group-hover:text-[#1968b4]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M7 17 17 7M8 7h9v9"
                          />
                        </svg>
                      </div>
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-6 border-t border-[#302d2d] pt-5 text-sm leading-6 text-[#302d2d]/70">
                No useful sources were found. Try a broader project description
                or verify the city name.
              </p>
            )}
          </section>
        )}

        <p className="mt-7 text-center text-sm leading-5 text-[#302d2d]/60">
          Always confirm final requirements with your local permitting office.
        </p>
      </div>
    </main>
  )
}

function formatCity(city: City) {
  return [city.name, city.region].filter(Boolean).join(', ')
}
