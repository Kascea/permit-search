import type { PermitStatusFetcher } from '#/lib/tracking/fetcher.server'
import { logisStatusFetcher } from '#/lib/tracking/logis.server'
import type { PermitProviderId } from '#/lib/tracking/providers'

// Every provider needs a fetcher, or this won't compile.
export const STATUS_FETCHERS: Record<PermitProviderId, PermitStatusFetcher> = {
  'logis-epermits': logisStatusFetcher,
}
