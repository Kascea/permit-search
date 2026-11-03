// Builds the city list behind autocomplete and "Detect my city" from free
// U.S. Census Bureau files.
//
// Run with `npm run data:places` when the Census publishes new vintages and
// update the URLs below. Requires `unzip` on the PATH.
//
// us-places.tsv has one `name<TAB>state[<TAB>county]` line per place, ordered
// by population; county is only present when a name repeats within a state.
// us-place-ids.txt holds each line's Census GEOID, in the same order, for the
// server to match reverse-geocoding results without the browser loading it.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const GAZETTEER_URL =
  'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip'
const POPULATION_URL =
  'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv'
const PLACES_OUTPUT = new URL(
  '../src/lib/location/us-places.tsv',
  import.meta.url,
)
const IDS_OUTPUT = new URL(
  '../src/lib/location/us-place-ids.txt',
  import.meta.url,
)

// Towns and townships below this size rarely run their own permit office.
const MIN_TOWNSHIP_POPULATION = 1000

// Consolidated governments whose legal names nobody types.
const NAME_OVERRIDES = {
  'Nashville-Davidson metropolitan government (balance)': 'Nashville',
  'Louisville/Jefferson County metro government (balance)': 'Louisville',
  'Lexington-Fayette urban county': 'Lexington',
  'Athens-Clarke County unified government (balance)': 'Athens',
  'Augusta-Richmond County consolidated government (balance)': 'Augusta',
  'Macon-Bibb County': 'Macon',
  'Butte-Silver Bow (balance)': 'Butte',
  'Anaconda-Deer Lodge County': 'Anaconda',
  'Urban Honolulu CDP': 'Honolulu',
}

const LEGAL_SUFFIX =
  / (city and borough|unified government|consolidated government|metropolitan government|metro government|urban county|charter township|city|town|village|borough|CDP|municipality|corporation|plantation|township)$/

const [gazetteer, population] = await Promise.all([
  downloadGazetteer(),
  download(POPULATION_URL).then((bytes) =>
    new TextDecoder('latin1').decode(bytes),
  ),
])

const populationRows = parseDelimited(population, ',')
const stateAbbreviations = new Map()
const countyNames = new Map()
const placePopulation = new Map()
const placeCounty = new Map()
const entries = []

for (const row of parseDelimited(gazetteer, '\t')) {
  stateAbbreviations.set(row.GEOID.slice(0, 2), row.USPS)
}

for (const row of populationRows) {
  const pop = Number(row.POPESTIMATE2024) || 0

  if (row.SUMLEV === '050') {
    countyNames.set(row.STATE + row.COUNTY, row.NAME)
  } else if (row.SUMLEV === '162') {
    placePopulation.set(row.STATE + row.PLACE, pop)
  } else if (row.SUMLEV === '157') {
    // Places split across counties: remember the county with the most people.
    const geoid = row.STATE + row.PLACE
    const current = placeCounty.get(geoid)
    if (!current || pop > current.pop) {
      placeCounty.set(geoid, { county: row.STATE + row.COUNTY, pop })
    }
  } else if (
    row.SUMLEV === '061' &&
    row.FUNCSTAT === 'A' &&
    pop >= MIN_TOWNSHIP_POPULATION &&
    / (town|township|plantation)$/.test(row.NAME)
  ) {
    entries.push({
      kind: 'township',
      rawName: row.NAME,
      name: cleanName(row.NAME),
      state: stateAbbreviations.get(row.STATE),
      geoid: row.STATE + row.COUNTY + row.COUSUB,
      county: row.STATE + row.COUNTY,
      pop,
    })
  }
}

for (const row of parseDelimited(gazetteer, '\t')) {
  if (row.FUNCSTAT !== 'A' && row.FUNCSTAT !== 'S') continue
  if (row.USPS === 'PR') continue

  entries.push({
    kind: row.FUNCSTAT === 'A' ? 'city' : 'cdp',
    rawName: row.NAME,
    name: cleanName(row.NAME),
    state: row.USPS,
    geoid: row.GEOID,
    county: placeCounty.get(row.GEOID)?.county,
    // Unincorporated places have no estimate, so they rank after cities.
    pop: placePopulation.get(row.GEOID) ?? -1,
  })
}

// The population file repeats some towns, once per summary level they
// belong to.
const unique = [
  ...new Map(entries.map((entry) => [entry.geoid, entry])).values(),
]
const results = resolveCollisions(unique)
results.sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name))

const lines = results.map((entry) =>
  [entry.name, entry.state, entry.countyLabel].filter(Boolean).join('\t'),
)
writeFileSync(PLACES_OUTPUT, lines.join('\n') + '\n')
writeFileSync(IDS_OUTPUT, results.map((entry) => entry.geoid).join('\n') + '\n')
console.log(`Wrote ${lines.length} places to ${PLACES_OUTPUT.pathname}`)

function cleanName(rawName) {
  if (NAME_OVERRIDES[rawName]) return NAME_OVERRIDES[rawName]
  return rawName.replace(/ \(balance\)$/, '').replace(LEGAL_SUFFIX, '')
}

// Names must be unique within a state for people to tell them apart.
function resolveCollisions(all) {
  const byKey = Map.groupBy(all, (entry) => `${entry.state}|${entry.name}`)
  const kept = []

  for (const group of byKey.values()) {
    const governments = group
      .filter((entry) => entry.kind !== 'cdp')
      .sort((a, b) => b.pop - a.pop)
    // A CDP sharing a name with a city or town lies inside or beside it,
    // and that government is the one issuing permits. Same-named CDPs can't
    // be told apart without a county, which the place file lacks, so only
    // one is kept.
    const members = governments.length > 0 ? governments : group.slice(0, 1)
    const largestCity = members.find((entry) => entry.kind === 'city')

    for (const entry of members) {
      if (entry.kind === 'township' && largestCity) {
        entry.name = entry.rawName.endsWith('township')
          ? `${entry.name} Township`
          : `Town of ${entry.name}`
      } else if (entry.kind === 'city' && entry !== largestCity) {
        // A city and a village of one name, like Waukesha, Wisconsin.
        const type = legalType(entry)
        if (type && type !== legalType(largestCity)) {
          entry.name = `${type[0].toUpperCase()}${type.slice(1)} of ${entry.name}`
        }
      }
      kept.push(entry)
    }
  }

  // Any names still repeated, such as the many Washington Townships, get
  // their county shown alongside.
  const counts = Map.groupBy(kept, (entry) => `${entry.state}|${entry.name}`)
  for (const group of counts.values()) {
    if (group.length < 2) continue
    for (const entry of group) {
      entry.countyLabel = countyNames.get(entry.county)
    }
  }

  return kept
}

function legalType(entry) {
  return entry.rawName.match(/ (city|town|village|borough)$/)?.[1]
}

async function downloadGazetteer() {
  const directory = mkdtempSync(join(tmpdir(), 'us-places-'))
  const zipPath = join(directory, 'places.zip')
  writeFileSync(zipPath, await download(GAZETTEER_URL))
  return execFileSync('unzip', ['-p', zipPath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

async function download(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

// Census files have no quoted fields, so a plain split is enough.
function parseDelimited(text, delimiter) {
  const [header, ...lines] = text.trim().split(/\r?\n/)
  const columns = header.split(delimiter).map((column) => column.trim())

  return lines.map((line) => {
    const values = line.split(delimiter)
    return Object.fromEntries(
      columns.map((column, index) => [column, values[index]?.trim() ?? '']),
    )
  })
}
