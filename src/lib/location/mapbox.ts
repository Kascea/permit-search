import type { City, CitySuggestion } from './types'
import { UserError } from '#/lib/errors'

const SEARCH_BOX_URL = 'https://api.mapbox.com/search/searchbox/v1'

interface MapboxContext {
  country?: { name?: string }
  region?: { name?: string }
  place?: { id?: string; name?: string }
}

interface MapboxSuggestion {
  mapbox_id?: string
  name?: string
  feature_type?: string
  place_formatted?: string
  context?: MapboxContext
}

interface MapboxFeature {
  geometry?: {
    coordinates?: [number, number]
  }
  properties?: MapboxSuggestion
}

interface SuggestResponse {
  suggestions?: MapboxSuggestion[]
}

interface FeatureCollection {
  features?: MapboxFeature[]
}

export function createMapboxSessionToken() {
  return crypto.randomUUID()
}

export async function searchUsCities(
  query: string,
  accessToken: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    access_token: accessToken,
    session_token: sessionToken,
    country: 'us',
    language: 'en',
    types: 'place',
    limit: '6',
  })

  const response = await fetch(`${SEARCH_BOX_URL}/suggest?${params}`, {
    signal,
  })
  const data = await parseResponse<SuggestResponse>(response)

  return (data.suggestions ?? []).flatMap((suggestion) => {
    if (!suggestion.mapbox_id || !suggestion.name) return []

    const region = suggestion.context?.region?.name
    const place = suggestion.place_formatted ?? region ?? 'United States'

    return [
      {
        id: suggestion.mapbox_id,
        name: suggestion.name,
        region,
        label: place,
      },
    ]
  })
}

export async function retrieveCity(
  suggestion: CitySuggestion,
  accessToken: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<City> {
  const params = new URLSearchParams({
    access_token: accessToken,
    session_token: sessionToken,
  })
  const response = await fetch(
    `${SEARCH_BOX_URL}/retrieve/${encodeURIComponent(suggestion.id)}?${params}`,
    { signal },
  )
  const data = await parseResponse<FeatureCollection>(response)
  const feature = data.features?.[0]

  return featureToCity(feature, suggestion.name, suggestion.region)
}

export async function reverseGeocodeCity(
  latitude: number,
  longitude: number,
  accessToken: string,
  signal?: AbortSignal,
): Promise<City> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    access_token: accessToken,
    country: 'us',
    language: 'en',
    types: 'place',
    limit: '1',
  })
  const response = await fetch(`${SEARCH_BOX_URL}/reverse?${params}`, {
    signal,
  })
  const data = await parseResponse<FeatureCollection>(response)
  const feature = data.features?.[0]

  if (!feature) {
    throw new UserError('We could not find a U.S. city for your location.')
  }

  return reverseFeatureToCity(feature)
}

function reverseFeatureToCity(feature: MapboxFeature): City {
  const properties = feature.properties
  const place = properties?.context?.place
  const isPlace = properties?.feature_type === 'place'
  const name = isPlace ? properties.name : place?.name
  const id = isPlace ? properties.mapbox_id : place?.id

  if (!name) {
    throw new UserError('We could not determine the city for your location.')
  }

  return {
    id,
    name,
    region: properties?.context?.region?.name,
    country: 'United States',
  }
}

function featureToCity(
  feature: MapboxFeature | undefined,
  fallbackName?: string,
  fallbackRegion?: string,
): City {
  const properties = feature?.properties
  const coordinates = feature?.geometry?.coordinates
  const name = properties?.name ?? fallbackName

  if (!name) {
    throw new UserError('That city couldn’t be selected. Try another.')
  }

  return {
    id: properties?.mapbox_id,
    name,
    region: properties?.context?.region?.name ?? fallbackRegion,
    country: 'United States',
    ...(coordinates
      ? {
          coordinates: {
            longitude: coordinates[0],
            latitude: coordinates[1],
          },
        }
      : {}),
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // A bad token is ours to fix, so it's logged rather than shown.
    if (response.status === 401) {
      console.error('Mapbox rejected the access token as invalid.')
    } else if (response.status === 403) {
      console.error(
        'The Mapbox token is not allowed for this domain or is missing a scope.',
      )
    }

    throw new UserError('The city search service is temporarily unavailable.')
  }

  return response.json<T>()
}
