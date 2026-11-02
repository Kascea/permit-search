import { createServerFn } from '@tanstack/react-start'

import {
  loadSavedSearch,
  runSavedSearch,
} from '#/lib/saved-searches/saved-searches.server'
import type { PermitSearchInput } from '#/lib/search/types'

interface StartSearchInput extends PermitSearchInput {
  // Run the search even when a recent matching one is saved.
  fresh?: boolean
}

// Reuses or runs a search and returns the saved search's public ID.
export const startSearch = createServerFn({ method: 'POST' })
  .validator((input: StartSearchInput): StartSearchInput => ({
    ...validatePermitSearch(input),
    fresh: input.fresh === true,
  }))
  .handler(({ data }) => runSavedSearch(data, { fresh: data.fresh }))

export const getSavedSearch = createServerFn({ method: 'GET' })
  .validator((input: { publicId: string }) => {
    if (!/^[A-Za-z0-9]{8,16}$/.test(input.publicId)) {
      throw new Error('That search link is not valid.')
    }
    return input
  })
  .handler(({ data }) => loadSavedSearch(data.publicId))

function validatePermitSearch(input: PermitSearchInput): PermitSearchInput {
  const cityName = input.city.name.trim()
  const region = input.city.region?.trim()
  const permit = input.permit.trim()

  if (!cityName || !region || !permit) {
    throw new Error(
      'Select a city and state, then describe the permit you need.',
    )
  }

  if (cityName.length > 100 || region.length > 100) {
    throw new Error('Enter a valid city.')
  }

  if (permit.length > 240) {
    throw new Error('Keep your permit description under 240 characters.')
  }

  return {
    city: {
      name: cityName,
      region,
      country: 'United States',
    },
    permit,
  }
}
