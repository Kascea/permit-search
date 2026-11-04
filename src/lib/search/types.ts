import type { City } from '#/lib/location/types'
import type { OnlineApplicationMatch } from '#/lib/portals/types'

export interface PermitSearchInput {
  city: City
  permit: string
}

export interface PermitSearchResult {
  title: string
  url: string
  domain: string
  description: string
  score: number
  isGovernmentSource: boolean
  // Whether the link opened a PDF when the search checked it. Missing on
  // searches saved before links were checked.
  isPdf?: boolean
}

export interface PermitSearchResponse {
  query: string
  results: Array<PermitSearchResult>
  // True when no project-specific link was found and the results are the
  // city's general permit pages instead.
  isGeneralFallback: boolean
  // The permit types Jev identified for the project, such as "building permit".
  permitTypes: Array<string>
  // In a city on a supported permit portal, the city's own online permit
  // types the project needs. Missing on searches saved before this, and on
  // searches in other cities.
  onlineApplications?: Array<OnlineApplicationMatch>
  // The portal those types are from, when the city has one, even if nothing
  // matched.
  portal?: { provider: string; providerName: string; applyUrl: string }
}
