import { austinCatalogReader } from '#/lib/portals/austin-catalog.server'
import { austinStatusFetcher } from '#/lib/portals/austin.server'
import type {
  PermitStatusFetcher,
  PortalCatalogReader,
} from '#/lib/portals/fetcher.server'
import { logisCatalogReader } from '#/lib/portals/logis-catalog.server'
import { logisStatusFetcher } from '#/lib/portals/logis.server'
import type { PermitProviderId } from '#/lib/portals/providers'

// Every provider needs a fetcher, or this won't compile.
export const STATUS_FETCHERS: Record<PermitProviderId, PermitStatusFetcher> = {
  'logis-epermits': logisStatusFetcher,
  'austin-development-services': austinStatusFetcher,
}

// Only providers whose capabilities include catalog have one.
export const CATALOG_READERS: Partial<
  Record<PermitProviderId, PortalCatalogReader>
> = {
  'logis-epermits': logisCatalogReader,
  'austin-development-services': austinCatalogReader,
}
