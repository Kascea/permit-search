import { useId, useState } from 'react'
import type { ReactNode } from 'react'

import { errorMessage } from '#/lib/errors'
import { CityCombobox } from '#/components/CityCombobox'
import { formatCity } from '#/lib/location/format'
import { locateCity } from '#/lib/location/locate'
import type { City } from '#/lib/location/types'
import { Notice } from '#/components/Notice'

interface PermitSearchFormProps {
  initialCity?: City
  initialPermit?: string
  title?: string
  // Shown at the end of the header, such as the search modal's close button.
  headerAction?: ReactNode
  className?: string
  onSearch: (city: City, permit: string) => void
}

// The city and project form shared by the home page and the results page's
// search modal. It validates input and hands the search to onSearch.
export function PermitSearchForm({
  initialCity,
  initialPermit = '',
  title = 'Start your search',
  headerAction,
  className = 'border border-ink p-5 sm:p-6',
  onSearch,
}: PermitSearchFormProps) {
  const permitInputId = useId()
  const [cityInput, setCityInput] = useState(
    initialCity ? formatCity(initialCity) : '',
  )
  const [selectedCity, setSelectedCity] = useState(initialCity)
  const [permitQuery, setPermitQuery] = useState(initialPermit)
  const [formError, setFormError] = useState('')
  const [locationError, setLocationError] = useState('')
  const [isLocating, setIsLocating] = useState(false)

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
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const city = await locateCity({
            data: { latitude: coords.latitude, longitude: coords.longitude },
          })
          selectCity(city)
        } catch (error) {
          setLocationError(
            errorMessage(error, 'We could not determine your city.'),
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

    if (!city.region) {
      setFormError(
        'Select a city and state, then describe the permit you need.',
      )
      return
    }

    setFormError('')
    onSearch(city, permitValue)
  }

  return (
    <form
      className={`bg-paper ${className}`}
      noValidate
      onSubmit={submitSearch}
    >
      <div className="mb-8 flex items-center justify-between gap-4 border-b border-ink pb-5">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="flex min-w-0 items-center gap-3">
          {/* The city this search will run in. */}
          <span
            className={`flex min-w-0 items-center gap-2 text-sm font-medium ${
              selectedCity ? 'text-ink' : 'text-ink/50'
            }`}
          >
            <span
              className={`size-2 shrink-0 rounded-full ${
                selectedCity ? 'bg-blueprint' : 'bg-ink/30'
              }`}
            />
            <span className="truncate">
              {selectedCity ? formatCity(selectedCity) : 'No city selected'}
            </span>
          </span>
          {headerAction}
        </span>
      </div>

      <div>
        <CityCombobox
          selectedCity={selectedCity}
          value={cityInput}
          onChange={updateCityInput}
          onCitySelected={selectCity}
          labelAction={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/40 px-2.5 py-1 text-xs font-medium text-ink transition hover:border-ink hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-60"
              disabled={isLocating}
              onClick={useCurrentLocation}
            >
              {isLocating ? (
                <span className="size-3 spinner" />
              ) : (
                <svg
                  aria-hidden="true"
                  className="size-3.5"
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
              {isLocating ? 'Finding…' : 'Detect my city'}
            </button>
          }
        />

        {locationError && (
          <p className="mt-2 text-sm font-medium text-redline" role="alert">
            {locationError}
          </p>
        )}
      </div>

      <div className="mt-7">
        <label
          className="mb-2 block text-sm font-medium text-ink"
          htmlFor={permitInputId}
        >
          Project or permit
        </label>
        <textarea
          id={permitInputId}
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
        <Notice tone="error" className="mt-4">
          {formError}
        </Notice>
      )}

      <button
        type="submit"
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-blueprint px-5 py-4 text-lg font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint"
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
  )
}
