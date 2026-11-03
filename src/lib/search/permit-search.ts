import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { getSessionUser } from '#/lib/auth/auth.server'
import {
  loadSavedSearch,
  loadSearchSummary,
  runSavedSearch,
} from '#/lib/saved-searches/saved-searches.server'
import type { PermitSearchInput } from '#/lib/search/types'
import { UserError } from '#/lib/errors'

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
  .handler(({ data }) => {
    // Not awaited here: the session check runs alongside the search lookup.
    const userId = getSessionUser(new Headers(getRequestHeaders())).then(
      (user) => user?.id ?? null,
    )
    return runSavedSearch(data, { fresh: data.fresh, userId })
  })

export const getSavedSearch = createServerFn({ method: 'GET' })
  .validator(validatePublicId)
  .handler(({ data }) => loadSavedSearch(data.publicId))

// A search's city and permit, for naming it in a breadcrumb.
export const getSearchSummary = createServerFn({ method: 'GET' })
  .validator(validatePublicId)
  .handler(({ data }) => loadSearchSummary(data.publicId))

function validatePublicId(input: { publicId: string }) {
  if (!/^[A-Za-z0-9]{8,16}$/.test(input.publicId)) {
    throw new UserError('That search link is not valid.')
  }
  return input
}

function validatePermitSearch(input: PermitSearchInput): PermitSearchInput {
  const cityName = input.city.name.trim()
  const region = input.city.region?.trim()
  const permit = input.permit.trim()

  if (!cityName || !region || !permit) {
    throw new UserError(
      'Select a city and state, then describe the permit you need.',
    )
  }

  if (cityName.length > 100 || region.length > 100) {
    throw new UserError('Enter a valid city.')
  }

  if (permit.length > 240) {
    throw new UserError('Keep your permit description under 240 characters.')
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
