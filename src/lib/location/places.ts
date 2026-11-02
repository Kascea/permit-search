import { STATE_NAMES } from './states'
import type { City, CitySuggestion } from './types'

// U.S. cities, towns, and townships from Census data, built by
// scripts/build-us-places.mjs. Searching happens in the browser, so the list
// is fetched once, on first use, instead of calling a paid search API.

export interface Place {
  index: number
  name: string
  state: string
  county?: string
  // The name as matched against queries; see normalize.
  key: string
}

let loadedPlaces: Place[] | undefined
let loadingPlaces: Promise<Place[]> | undefined

export function getLoadedPlaces() {
  return loadedPlaces
}

export function loadPlaces(): Promise<Place[]> {
  loadingPlaces ??= import('./us-places.tsv?raw').then(
    ({ default: text }) => (loadedPlaces = parsePlaces(text)),
    (error: unknown) => {
      // Let a later attempt retry, such as after a dropped connection.
      loadingPlaces = undefined
      throw error
    },
  )
  return loadingPlaces
}

export function parsePlaces(text: string): Place[] {
  return text
    .trimEnd()
    .split('\n')
    .map((line, index) => {
      const [name, state, county] = line.split('\t')
      return {
        index,
        name,
        state,
        county,
        // "Town of Hempstead" should match "hempstead" as well as its village.
        key: normalize(name).replace(/^(town|village|city|borough) of /, ''),
      }
    })
}

export function placeToCity(place: Place): City {
  return {
    id: String(place.index),
    name: place.name,
    region: STATE_NAMES[place.state],
    country: 'United States',
  }
}

export function placeToSuggestion(place: Place): CitySuggestion {
  const region = STATE_NAMES[place.state]
  return {
    id: String(place.index),
    name: place.name,
    region,
    label: place.county ? `${place.county}, ${region}` : region,
  }
}

// Places are ordered by population, so within each kind of match the bigger
// place comes first: exact names, then names starting with the query, then
// names with a later word starting with it ("vegas" for Las Vegas).
export function searchPlaces(
  places: Place[],
  query: string,
  limit = 6,
): CitySuggestion[] {
  const found = new Set<Place>()

  for (const { name, states } of interpretQuery(query)) {
    if (!name) continue
    const tiers: Place[][] = [[], [], []]

    for (const place of places) {
      if (states && !states.has(place.state)) continue
      if (place.key === name) tiers[0].push(place)
      else if (place.key.startsWith(name)) tiers[1].push(place)
      else if (place.key.includes(` ${name}`)) tiers[2].push(place)
    }

    for (const place of tiers.flat()) {
      if (found.size >= limit) break
      found.add(place)
    }
  }

  return [...found].map(placeToSuggestion)
}

interface QueryReading {
  name: string
  // Undefined means any state.
  states?: Set<string>
}

const STATE_BY_KEY = new Map(
  Object.entries(STATE_NAMES).flatMap(([abbreviation, stateName]) => [
    [abbreviation.toLowerCase(), abbreviation],
    [normalize(stateName), abbreviation],
  ]),
)

// "Springfield, Ill" and "austin tx" narrow to a state; a query with a
// trailing state is also searched as a whole, for names like "Indiana".
function interpretQuery(query: string): QueryReading[] {
  const [cityPart, ...stateParts] = query.split(',')
  const name = normalize(cityPart)

  if (stateParts.length > 0) {
    const statePart = normalize(stateParts.join(' '))
    if (!statePart) return [{ name }]

    const states = new Set(
      Object.entries(STATE_NAMES)
        .filter(
          ([abbreviation, stateName]) =>
            abbreviation.toLowerCase() === statePart ||
            normalize(stateName).startsWith(statePart),
        )
        .map(([abbreviation]) => abbreviation),
    )
    return [{ name, states }]
  }

  const words = name.split(' ')
  const readings: QueryReading[] = []

  // Two words first, for states like "New York".
  for (const count of [2, 1]) {
    if (words.length <= count) continue
    const state = STATE_BY_KEY.get(words.slice(-count).join(' '))
    if (state) {
      readings.push({
        name: words.slice(0, -count).join(' '),
        states: new Set([state]),
      })
    }
  }

  readings.push({ name })
  return readings
}

// Lowercase, without accents or punctuation, with common abbreviations
// spelled one way so "St. Louis" and "saint louis" match.
export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bmount\b/g, 'mt')
    .replace(/\bfort\b/g, 'ft')
}
