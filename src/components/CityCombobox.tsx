import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import {
  createMapboxSessionToken,
  retrieveCity,
  searchUsCities,
} from '#/lib/location/mapbox'
import type { City, CitySuggestion } from '#/lib/location/types'

interface CityComboboxProps {
  accessToken?: string
  selectedCity?: City
  value: string
  onChange: (value: string) => void
  onCitySelected: (city: City) => void
  labelAction?: ReactNode
}

export function CityCombobox({
  accessToken,
  selectedCity,
  value,
  onChange,
  onCitySelected,
  labelAction,
}: CityComboboxProps) {
  const inputId = useId()
  const listboxId = useId()
  const sessionToken = useRef<string | null>(null)
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = value.trim()

    if (!accessToken || selectedCity || query.length < 2) {
      setSuggestions([])
      setActiveIndex(-1)
      setIsSearching(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsSearching(true)
      setError('')

      try {
        sessionToken.current ??= createMapboxSessionToken()
        const results = await searchUsCities(
          query,
          accessToken,
          sessionToken.current,
          controller.signal,
        )
        setSuggestions(results)
        setActiveIndex(results.length > 0 ? 0 : -1)
      } catch (searchError) {
        if (controller.signal.aborted) return
        setSuggestions([])
        setError(
          searchError instanceof Error
            ? searchError.message
            : 'City search is unavailable.',
        )
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [accessToken, selectedCity, value])

  async function selectSuggestion(suggestion: CitySuggestion) {
    if (!accessToken) return

    setIsSearching(true)
    setError('')

    try {
      const activeSession = sessionToken.current ?? createMapboxSessionToken()
      const city = await retrieveCity(suggestion, accessToken, activeSession)
      onCitySelected(city)
      setSuggestions([])
      setActiveIndex(-1)
      sessionToken.current = null
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : 'That city could not be selected.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(
        (current) => (current - 1 + suggestions.length) % suggestions.length,
      )
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      void selectSuggestion(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setSuggestions([])
      setActiveIndex(-1)
    }
  }

  const hasSuggestions = suggestions.length > 0

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label
          className="block text-sm font-medium text-[#302d2d]"
          htmlFor={inputId}
        >
          City
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400"
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
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={hasSuggestions}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          autoComplete="off"
          className="field-input pr-12 pl-12"
          placeholder="Start typing a U.S. city"
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setError('')
          }}
          onKeyDown={handleKeyDown}
        />
        {isSearching && (
          <span
            aria-label="Searching cities"
            className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[#1968b4]/20 border-t-[#1968b4]"
          />
        )}
      </div>

      {hasSuggestions && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-[2px] border border-[#302d2d] bg-[#fdfff1] p-2"
        >
          {suggestions.map((suggestion, index) => (
            <li
              id={`${listboxId}-${index}`}
              key={suggestion.id}
              role="option"
              aria-selected={activeIndex === index}
            >
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded-[2px] px-3 py-3 text-left transition ${
                  activeIndex === index
                    ? 'bg-[#1968b4] text-[#fdfff1]'
                    : 'text-[#302d2d] hover:bg-[#302d2d]/10'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => void selectSuggestion(suggestion)}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full border ${
                    activeIndex === index
                      ? 'border-[#fdfff1]/35 bg-[#fdfff1]/10'
                      : 'border-[#302d2d]/20 bg-[#fdfff1]'
                  }`}
                >
                  <svg
                    aria-hidden="true"
                    className="size-4"
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
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block font-medium ${
                      activeIndex === index
                        ? 'text-[#fdfff1]'
                        : 'text-[#302d2d]'
                    }`}
                  >
                    {suggestion.name}
                  </span>
                  <span
                    className={`mt-0.5 block text-sm ${
                      activeIndex === index
                        ? 'text-[#fdfff1]/70'
                        : 'text-[#302d2d]/60'
                    }`}
                  >
                    {suggestion.label}
                  </span>
                </span>
                <svg
                  aria-hidden="true"
                  className={`size-4 shrink-0 ${
                    activeIndex === index
                      ? 'text-[#fdfff1]/70'
                      : 'text-[#302d2d]/40'
                  }`}
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
            </li>
          ))}
        </ul>
      )}

      {!accessToken && (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Autocomplete is off. Manual entry still works.
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm font-medium text-rose-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
