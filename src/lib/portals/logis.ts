import { z } from 'zod'

import type { Jurisdiction, PermitProvider } from '#/lib/portals/providers'

// LOGIS member cities with a permit search on epermits.logis.org. Each code is
// the portal's ?city= value, and its permit numbers are that code in capitals
// followed by six digits: the search page masks the field as "SL______".
// Farmington and New Hope are on the portal but have no permit search.
const LOGIS_CITIES: Array<[code: string, name: string]> = [
  ['av', 'Apple Valley'],
  ['cy', 'Crystal'],
  ['ep', 'Eden Prairie'],
  ['ed', 'Edina'],
  ['gv', 'Golden Valley'],
  ['ls', 'Le Sueur'],
  ['mg', 'Maple Grove'],
  ['mi', 'Minnetonka'],
  ['ra', 'Ramsey'],
  ['sa', 'Savage'],
  ['ss', 'South St. Paul'],
  ['sl', 'St. Louis Park'],
  ['wa', 'Waconia'],
  ['wb', 'White Bear Lake'],
]

export const LOGIS_PORTAL_URL = 'https://epermits.logis.org'

// Sent with every request, so LOGIS can see who's asking and reach us.
export const LOGIS_USER_AGENT =
  'PermitSearch/1.0 (+https://permitsearch.app; permit status for the permit holder)'

function prefix(jurisdiction: Jurisdiction) {
  return jurisdiction.code.toUpperCase()
}

export const logisEpermits: PermitProvider = {
  name: 'LOGIS ePermits',
  description:
    'A shared permit portal run by LOGIS, a cooperative of Twin Cities metro cities.',
  capabilities: { catalog: true, statusLookup: true, submission: false },
  jurisdictions: LOGIS_CITIES.map(([code, name]) => ({
    code,
    city: { name, region: 'Minnesota' },
  })),

  // "sl 306-008" and "306008" both become "SL306008".
  permitNumberSchema: (jurisdiction) => {
    const cityPrefix = prefix(jurisdiction)
    const invalid = `${jurisdiction.city.name} permit numbers look like ${cityPrefix}123456.`

    return z
      .string({ error: invalid })
      .transform((number) => number.toUpperCase().replace(/[\s-]/g, ''))
      .transform((number) =>
        /^\d{6}$/.test(number) ? `${cityPrefix}${number}` : number,
      )
      .refine((number) => new RegExp(`^${cityPrefix}\\d{6}$`).test(number), {
        error: invalid,
      })
  },

  placeholder: (jurisdiction) => `${prefix(jurisdiction)}123456`,

  applyUrl: (jurisdiction) =>
    `${LOGIS_PORTAL_URL}/home.aspx?city=${jurisdiction.code}`,

  // Public: no sign-in, and an unknown number says "could not be found".
  permitUrl: (jurisdiction, permitNumber) =>
    `${LOGIS_PORTAL_URL}/permits/permitdetails.aspx?${new URLSearchParams({
      city: jurisdiction.code,
      permitnbr: permitNumber,
    })}`,
}
