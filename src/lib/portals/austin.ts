import { z } from 'zod'

import type { PermitProvider } from '#/lib/portals/providers'

// The City of Austin's own permit system. Permits are filed on two routes,
// the Austin Build + Connect (AB+C) portal and the city's web forms, so the
// provider is named for the department. See docs/austin-permits.md.

export const AUSTIN_TYPES_OF_PERMITS_URL =
  'https://www.austintexas.gov/development-services/types-permits'

// Needs no sign-in. The portal can't take a permit number in its URL, so this
// opens the search, not the permit.
const AUSTIN_PUBLIC_SEARCH_URL =
  'https://abc.austintexas.gov/citizenportal/app/public-search'

// Sent with every request to the city's website and open data.
export const AUSTIN_USER_AGENT = 'PermitSearch/1.0'

const INVALID_NUMBER = 'Austin permit numbers look like 2026-123456 BP.'

export const austinDevelopmentServices: PermitProvider = {
  name: 'Development Services',
  description:
    'Austin’s permit system: the Austin Build + Connect portal and the city’s web forms, with status from the city’s open data.',
  capabilities: { catalog: true, statusLookup: true, submission: false },
  jurisdictions: [
    {
      code: 'austin',
      city: { name: 'Austin', region: 'Texas' },
      formsPage: {
        title: 'Austin Development Services forms and applications',
        url: 'https://www.austintexas.gov/development-services/forms-applications',
      },
    },
  ],

  // "2026136709ep" and "2026-136709 EP" both become "2026-136709 EP".
  permitNumberSchema: () =>
    z
      .string({ error: INVALID_NUMBER })
      .transform((number) =>
        number
          .toUpperCase()
          .trim()
          .replace(/^(\d{4})[\s-]*(\d{6})[\s-]*([A-Z]{2,3})$/, '$1-$2 $3'),
      )
      .refine((number) => /^\d{4}-\d{6} [A-Z]{2,3}$/.test(number), {
        error: INVALID_NUMBER,
      }),

  placeholder: () => '2026-123456 BP',

  // Lists every permit with its own way to apply, which AB+C can't do without
  // signing in.
  applyUrl: () => AUSTIN_TYPES_OF_PERMITS_URL,

  // Until a check finds the permit's own link; see PermitStatus.permitUrl.
  permitUrl: () => AUSTIN_PUBLIC_SEARCH_URL,
}
