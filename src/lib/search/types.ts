import type { City } from '#/lib/location/types'

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
}

export interface PermitSearchResponse {
  query: string
  results: Array<PermitSearchResult>
  // True when no project-specific link was found and the results are the
  // city's general permit pages instead.
  isGeneralFallback: boolean
  // The permit types Jev identified for the project, such as "building permit".
  permitTypes: Array<string>
}
