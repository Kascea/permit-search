import { waitUntil } from 'cloudflare:workers'

import { collectCityContacts } from '#/lib/contacts/collect.server'
import type { CollectedContacts } from '#/lib/contacts/collect.server'
import {
  isFresh,
  loadCity,
  postponeRefresh,
  saveCollectedContacts,
  upsertCity,
} from '#/lib/contacts/store.server'
import { OFFICE_PRIORITY } from '#/lib/contacts/types'
import type { CityContactsResponse, OfficeContact } from '#/lib/contacts/types'
import { hasDatabase, withDatabase } from '#/lib/db/client.server'
import type { City, CityOffice } from '#/lib/db/schema'

interface CityName {
  name: string
  region: string
}

const UNAVAILABLE: CityContactsResponse = {
  status: 'unavailable',
  primaryOffice: null,
  otherOffices: [],
  portalUrl: null,
  permitsUrl: null,
  checkedAt: null,
}

// Saved and fresh: served as is. Saved but expired: served as is while a
// refresh runs after the response. Never collected: collected now.
export async function getCityContacts(
  input: CityName,
): Promise<CityContactsResponse> {
  if (!hasDatabase()) {
    return UNAVAILABLE
  }

  try {
    const saved = await withDatabase((db) => loadCity(db, input))

    if (saved?.city.contactsStatus) {
      if (!isFresh(saved.city) || saved.city.expiresOn === null) {
        waitUntil(refreshCityContacts(input, saved.city, saved.offices))
      }
      console.log(
        JSON.stringify({
          message: 'city contacts served',
          city: saved.city.cityKey,
          source: isFresh(saved.city) ? 'saved' : 'saved, refreshing',
          status: saved.city.contactsStatus,
        }),
      )
      return toResponse(saved.city, saved.offices.map(toOfficeContact))
    }

    // A city that wasn't saved has no URLs yet, so collection needn't wait for
    // its row to be created.
    const [city, collected] = await Promise.all([
      saved?.city ?? withDatabase((db) => upsertCity(db, input)),
      collectCityContacts({
        ...input,
        savedUrls: saved ? savedUrlsFor(saved.city, []) : [],
      }),
    ])
    await withDatabase((db) => saveCollectedContacts(db, city.id, collected))

    return toResponse(
      {
        ...city,
        contactsStatus: collected.status,
        contactsCheckedAt: new Date(),
      },
      collected.offices,
      collected,
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'city contacts failed',
        city: `${input.name}, ${input.region}`,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    return UNAVAILABLE
  }
}

async function refreshCityContacts(
  input: CityName,
  city: City,
  offices: Array<CityOffice>,
) {
  try {
    const collected = await collectCityContacts({
      ...input,
      savedUrls: savedUrlsFor(city, offices),
    })
    await withDatabase((db) => saveCollectedContacts(db, city.id, collected))
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'city contacts refresh failed',
        city: city.cityKey,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    await withDatabase((db) => postponeRefresh(db, city.id)).catch(() => {})
  }
}

function savedUrlsFor(city: City, offices: Array<CityOffice>) {
  return [
    ...new Set(
      [
        ...offices.map(({ sourceUrl }) => sourceUrl),
        city.permitsUrl,
        city.portalUrl,
      ].filter((url): url is string => Boolean(url)),
    ),
  ]
}

function toOfficeContact(office: CityOffice): OfficeContact {
  return {
    officeType: office.officeType,
    name: office.name,
    phone: office.phone,
    email: office.email,
    streetAddress: office.streetAddress,
    hours: office.hours,
    sourceUrl: office.sourceUrl,
  }
}

function toResponse(
  city: City,
  offices: Array<OfficeContact>,
  collected?: CollectedContacts,
): CityContactsResponse {
  const sorted = [...offices].sort(
    (first, second) =>
      OFFICE_PRIORITY.indexOf(first.officeType) -
      OFFICE_PRIORITY.indexOf(second.officeType),
  )
  return {
    status: city.contactsStatus ?? 'not_found',
    primaryOffice: sorted.at(0) ?? null,
    otherOffices: sorted.slice(1),
    portalUrl: collected?.portalUrl ?? city.portalUrl,
    permitsUrl: city.permitsUrl,
    checkedAt: city.contactsCheckedAt?.toISOString() ?? null,
  }
}
