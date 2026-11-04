import type { Jurisdiction } from '#/lib/portals/providers'
import type {
  PermitRequirements,
  PermitStatus,
  PortalTypeDetails,
} from '#/lib/portals/types'

// A failed status check whose message is written for the user and stored as
// the permit's check error. portalChanged marks a page the parser didn't
// recognize, which is logged so the parser can be fixed.
export class PermitCheckError extends Error {
  name = 'PermitCheckError'
  portalChanged: boolean

  constructor(message: string, options: { portalChanged?: boolean } = {}) {
    super(message)
    this.portalChanged = options.portalChanged ?? false
  }
}

// By name, like isUserError: a module loaded twice (as in Vite's dev server)
// has two copies of the class, and instanceof misses one.
export function isPermitCheckError(error: unknown): error is PermitCheckError {
  return error instanceof Error && error.name === 'PermitCheckError'
}

// One permit type as a catalog read finds it, before it's stored; see
// portal_permit_types.
export interface CatalogPermitType {
  externalId: string
  name: string
  category: string | null
  plansRequired: boolean | null
  pageUrl: string
  applyUrl: string | null
  feeEstimatorUrl: string | null
  details: PortalTypeDetails
}

// Reads a jurisdiction's permit types, and what each one requires, from its
// provider's portal. Server-only, like the status fetcher.
export interface PortalCatalogReader {
  listPermitTypes(jurisdiction: Jurisdiction): Promise<Array<CatalogPermitType>>
  readRequirements(
    jurisdiction: Jurisdiction,
    externalId: string,
  ): Promise<PermitRequirements>
}

// Reads a permit's status from its provider's portal. Server-only, so no
// scraping code reaches the browser.
export interface PermitStatusFetcher {
  fetchStatus(
    jurisdiction: Jurisdiction,
    permitNumber: string,
  ): Promise<PermitStatus>
}
