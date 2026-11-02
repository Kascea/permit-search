import { parsePlaces, placeToCity } from './places'
import type { Place } from './places'
import type { City } from './types'
import placeIds from './us-place-ids.txt?raw'
import placesText from './us-places.tsv?raw'
import { UserError } from '#/lib/errors'

// The Census Bureau's free geocoder. It doesn't allow browser requests, so
// reverse geocoding runs here.
const GEOCODER_URL =
  'https://geocoding.geo.census.gov/geocoder/geographies/coordinates'

// In order of preference: a city or village, then a town or township, then
// an unincorporated community.
const LAYERS = [
  'Incorporated Places',
  'County Subdivisions',
  'Census Designated Places',
]

interface GeocoderResponse {
  result?: {
    geographies?: Record<string, { GEOID?: string }[] | undefined>
  }
}

// Built on first use, then reused while the Worker stays warm.
let places: Place[] | undefined
let placeIndexById: Map<string, number> | undefined

export async function findCityAt(
  latitude: number,
  longitude: number,
): Promise<City> {
  const params = new URLSearchParams({
    x: String(longitude),
    y: String(latitude),
    benchmark: 'Public_AR_Current',
    vintage: 'Current_Current',
    layers: LAYERS.join(','),
    format: 'json',
  })
  const response = await fetch(`${GEOCODER_URL}?${params}`)

  if (!response.ok) {
    console.error(`Census geocoder returned ${response.status}.`)
    throw new UserError(
      'Location lookup is temporarily unavailable. Enter your city instead.',
    )
  }

  const data = await response.json<GeocoderResponse>()
  const geographies = data.result?.geographies ?? {}
  places ??= parsePlaces(placesText)
  placeIndexById ??= new Map(
    placeIds
      .trimEnd()
      .split('\n')
      .map((id, index) => [id, index]),
  )

  for (const layer of LAYERS) {
    for (const { GEOID } of geographies[layer] ?? []) {
      const index = GEOID ? placeIndexById.get(GEOID) : undefined
      if (index !== undefined) return placeToCity(places[index])
    }
  }

  throw new UserError('We could not find a U.S. city for your location.')
}
