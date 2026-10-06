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
}
