import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'

import { errorMessage } from '#/lib/errors'
import {
  getLoadedPlaces,
  loadPlaces,
  searchPlaces,
} from '#/lib/location/places'
import type { City, CitySuggestion } from '#/lib/location/types'

interface CityComboboxProps {
  selectedCity?: City
  value: string
  onChange: (value: string) => void
  onCitySelected: (city: City) => void
  labelAction?: ReactNode
  // Fits a table cell: the label is for screen readers only, and the input
  // takes this class instead of the pin icon and field border.
  compactInputClass?: string
}

export function CityCombobox({
  selectedCity,
  value,
  onChange,
  onCitySelected,
  labelAction,
  compactInputClass,
}: CityComboboxProps) {
  const inputId = useId()
  const listboxId = useId()
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = value.trim()

    function showResults(results: CitySuggestion[]) {
      setSuggestions(results)
      setActiveIndex(results.length > 0 ? 0 : -1)
      setIsSearching(false)
    }

    if (selectedCity || query.length < 2) {
      showResults([])

      return
    }

    // Once the list has loaded, searching it is instant.
    const loaded = getLoadedPlaces()

    if (loaded) {
      showResults(searchPlaces(loaded, query))

      return
    }

    let cancelled = false
    setIsSearching(true)
    setError('')
    loadPlaces().then(
      (places) => {
        if (!cancelled) showResults(searchPlaces(places, query))
      },
      (cause: unknown) => {
        if (cancelled) return
        showResults([])
        setError(errorMessage(cause, 'City search is unavailable.'))
      },
    )

    return () => {
      cancelled = true
    }
  }, [selectedCity, value])

  function selectSuggestion({ id, name, region }: CitySuggestion) {
    onCitySelected({ id, name, region, country: 'United States' })
    setSuggestions([])
    setActiveIndex(-1)
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
      selectSuggestion(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setSuggestions([])
      setActiveIndex(-1)
    }
  }

  const hasSuggestions = suggestions.length > 0

  return (
    <div className="relative">
      <div
        className={
          compactInputClass
            ? 'sr-only'
            : 'mb-2 flex items-center justify-between gap-3'
        }
      >
        <label className="block text-sm font-medium text-ink" htmlFor={inputId}>
          City
        </label>
        {labelAction}
      </div>
      <div className="relative">
        {!compactInputClass && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink/40"
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
        )}
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
          className={compactInputClass ?? 'field-input pr-12 pl-12'}
          placeholder="Start typing a U.S. city"
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setError('')
          }}
          onKeyDown={handleKeyDown}
          // Starts downloading the city list before the first keystroke.
          onFocus={() => void loadPlaces().catch(() => {})}
        />
        {isSearching && (
          <span
            aria-label="Searching cities"
            className="absolute top-1/2 right-4 size-4 -translate-y-1/2 spinner"
          />
        )}
      </div>

      {hasSuggestions && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xs border border-ink bg-paper p-2"
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
                className={`flex w-full items-center gap-3 rounded-xs px-3 py-3 text-left transition ${
                  activeIndex === index
                    ? 'bg-blueprint text-paper'
                    : 'text-ink hover:bg-ink/10'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectSuggestion(suggestion)}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full border ${
                    activeIndex === index
                      ? 'border-paper/35 bg-paper/10'
                      : 'border-ink/20 bg-paper'
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
                      activeIndex === index ? 'text-paper' : 'text-ink'
                    }`}
                  >
                    {suggestion.name}
                  </span>
                  <span
                    className={`mt-0.5 block text-sm ${
                      activeIndex === index ? 'text-paper/70' : 'text-ink/60'
                    }`}
                  >
                    {suggestion.label}
                  </span>
                </span>
                <svg
                  aria-hidden="true"
                  className={`size-4 shrink-0 ${
                    activeIndex === index ? 'text-paper/70' : 'text-ink/40'
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

      {error && (
        <p className="mt-2 text-sm font-medium text-redline" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
