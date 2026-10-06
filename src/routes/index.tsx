import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { CityCombobox } from '#/components/CityCombobox'
import { reverseGeocodeCity } from '#/lib/location/mapbox'
import type { City } from '#/lib/location/types'

export const Route = createFileRoute('/')({
  component: Home,
})

interface SearchResult {
  city: City
  permit: string
}

function Home() {
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
  const [cityInput, setCityInput] = useState('')
  const [selectedCity, setSelectedCity] = useState<City>()
  const [permitQuery, setPermitQuery] = useState('')
  const [formError, setFormError] = useState('')
  const [locationError, setLocationError] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [result, setResult] = useState<SearchResult>()

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

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
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
    setResult({ city, permit: permitValue })
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
              <p className="mt-2 text-sm font-medium text-amber-700" role="alert">
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
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-[#1968b4] px-5 py-4 text-lg font-medium text-[#fdfff1] transition hover:bg-[#145390] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1968b4]"
            >
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
            </button>
          </form>
        </div>

        {result && (
          <section
            id="search-result"
            aria-live="polite"
            className="mt-8 border-y border-[#302d2d] bg-[#fdfff1] py-6"
          >
            <div className="flex items-start gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#302d2d] text-[#fdfff1]">
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
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </span>
              <div>
                <p className="text-xs font-medium tracking-[0.16em] text-[#1968b4] uppercase">
                  Search ready
                </p>
                <h2 className="mt-1 text-2xl leading-tight font-medium tracking-[-0.02em] text-[#302d2d]">
                  {result.permit} in {formatCity(result.city)}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#302d2d]/70">
                  Official permit sources will appear here when search
                  integration is connected.
                </p>
              </div>
            </div>
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
