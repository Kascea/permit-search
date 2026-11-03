import { useEffect, useState } from 'react'

import { fetchCityContacts } from '#/lib/contacts/city-contacts'
import { cityKey } from '#/lib/contacts/types'
import type { CityContactsResponse } from '#/lib/contacts/types'

// One request per city per page session. Moving from a running search to its
// saved results page reuses the request instead of starting a second
// first-time collection.
const requests = new Map<string, Promise<CityContactsResponse | null>>()

function requestCityContacts(name: string, region: string) {
  const key = cityKey(name, region)
  let request = requests.get(key)

  if (!request) {
    request = fetchCityContacts({ data: { name, region } }).catch(() => {
      // The card is optional; let a later page try again.
      requests.delete(key)

      return null
    })
    requests.set(key, request)
  }

  return request
}

export function useCityContacts(name: string, region: string) {
  const [contacts, setContacts] = useState<CityContactsResponse>()

  useEffect(() => {
    if (!name || !region) {
      return
    }

    let cancelled = false
    setContacts(undefined)
    void requestCityContacts(name, region).then((response) => {
      if (!cancelled) {
        setContacts(response ?? undefined)
      }
    })

    return () => {
      cancelled = true
    }
  }, [name, region])

  return contacts
}
