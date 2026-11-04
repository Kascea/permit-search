import type { Jurisdiction } from '#/lib/tracking/providers'
import type { PermitStatus } from '#/lib/tracking/types'

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

// Reads a permit's status from its provider's portal. Server-only, so no
// scraping code reaches the browser.
export interface PermitStatusFetcher {
  fetchStatus(
    jurisdiction: Jurisdiction,
    permitNumber: string,
  ): Promise<PermitStatus>
}
