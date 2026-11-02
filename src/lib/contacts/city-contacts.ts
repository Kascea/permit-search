import { createServerFn } from '@tanstack/react-start'

import { getCityContacts } from '#/lib/contacts/city-contacts.server'
import { UserError } from '#/lib/errors'

interface CityContactsInput {
  name: string
  region: string
}

// Loaded alongside the search so contact collection never delays results.
export const fetchCityContacts = createServerFn({ method: 'POST' })
  .validator(validateCity)
  .handler(({ data }) => getCityContacts(data))

function validateCity(input: CityContactsInput): CityContactsInput {
  const name = input.name.trim()
  const region = input.region.trim()
  if (!name || !region || name.length > 100 || region.length > 100) {
    throw new UserError('Enter a valid city.')
  }
  return { name, region }
}
