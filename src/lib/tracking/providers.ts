import { z } from 'zod'

import { logisEpermits } from '#/lib/tracking/logis'

// A city as a provider knows it.
export interface Jurisdiction {
  // The provider's code for the city, such as "sl".
  code: string
  // Matched against a project's city.
  city: { name: string; region: string }
}

// A city permit portal whose permits can be tracked. Shared by the browser and
// the server; fetching status is server-only and lives elsewhere.
export interface PermitProvider {
  name: string
  jurisdictions: Array<Jurisdiction>
  // Normalizes a permit number for one city, with messages for people.
  permitNumberSchema: (jurisdiction: Jurisdiction) => z.ZodType<string>
  placeholder: (jurisdiction: Jurisdiction) => string
  // Where the user files with the city; we never file for them.
  applyUrl: (jurisdiction: Jurisdiction) => string
  // The permit's own page on the portal, which the user can open themselves.
  permitUrl: (jurisdiction: Jurisdiction, permitNumber: string) => string
}

// The database stores these keys as text, so adding a provider needs no
// migration.
export const PERMIT_PROVIDERS = {
  'logis-epermits': logisEpermits,
} as const satisfies Record<string, PermitProvider>

export type PermitProviderId = keyof typeof PERMIT_PROVIDERS

// SAFETY: the keys of a const object literal.
const PROVIDER_IDS = Object.keys(PERMIT_PROVIDERS) as Array<PermitProviderId>

export function isPermitProviderId(id: string): id is PermitProviderId {
  return Object.hasOwn(PERMIT_PROVIDERS, id)
}

export function findJurisdiction(provider: PermitProviderId, code: string) {
  return PERMIT_PROVIDERS[provider].jurisdictions.find(
    (jurisdiction) => jurisdiction.code === code,
  )
}

function sameCity(a: Jurisdiction['city'], b: Jurisdiction['city']) {
  return (
    a.name.toLowerCase() === b.name.toLowerCase() &&
    a.region.toLowerCase() === b.region.toLowerCase()
  )
}

// The provider and jurisdiction covering a project's city, or null.
export function providerForCity(
  city: Jurisdiction['city'] | null,
): { provider: PermitProviderId; jurisdiction: Jurisdiction } | null {
  if (!city) return null

  for (const provider of PROVIDER_IDS) {
    const jurisdiction = PERMIT_PROVIDERS[provider].jurisdictions.find(
      (candidate) => sameCity(candidate.city, city),
    )

    if (jurisdiction) return { provider, jurisdiction }
  }

  return null
}

// What the permit number dialog sends. The number comes back normalized by
// its provider's schema for the chosen city.
export const trackedPermitInputSchema = z
  .object({
    provider: z.string(),
    jurisdiction: z.string(),
    permitNumber: z.string().max(60, 'That permit number is too long.'),
  })
  .transform((input, context) => {
    if (!isPermitProviderId(input.provider)) {
      context.addIssue({
        code: 'custom',
        message: 'Permit tracking isn’t available for that portal.',
      })

      return z.NEVER
    }

    const jurisdiction = findJurisdiction(input.provider, input.jurisdiction)

    if (!jurisdiction) {
      context.addIssue({
        code: 'custom',
        message: 'Choose the city that issued the permit.',
      })

      return z.NEVER
    }

    const number = PERMIT_PROVIDERS[input.provider]
      .permitNumberSchema(jurisdiction)
      .safeParse(input.permitNumber)

    if (!number.success) {
      for (const issue of number.error.issues) {
        context.addIssue({ code: 'custom', message: issue.message })
      }

      return z.NEVER
    }

    return {
      provider: input.provider,
      jurisdiction: jurisdiction.code,
      permitNumber: number.data,
    }
  })

export type TrackedPermitInput = z.output<typeof trackedPermitInputSchema>
