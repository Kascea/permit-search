import { createServerFn } from '@tanstack/react-start'

import { searchPermitsWithTavily } from '#/lib/search/tavily.server'
import type { PermitSearchInput } from '#/lib/search/types'

export const searchPermits = createServerFn({ method: 'POST' })
  .validator(validatePermitSearch)
  .handler(({ data }) => searchPermitsWithTavily(data))

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
