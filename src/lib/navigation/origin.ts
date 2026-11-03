import { formatCity } from '#/lib/location/format'

// The page a page was opened from, kept in its URL as ?from= so the breadcrumb
// survives reloads and shared links: "search:k7Qm2xPz9aB4",
// "project:Hn3pQ8rT2wXa" or "drafts".
export type Origin =
  | { kind: 'search' | 'project'; id: string }
  | { kind: 'drafts' }

// The ?from= param's origin, if it names one.
export function parseOrigin(value: string | undefined): Origin | undefined {
  if (value === 'drafts') return { kind: 'drafts' }

  const match = /^(search|project):([A-Za-z0-9]{8,16})$/.exec(value ?? '')
  const kind = match?.[1]

  return match && (kind === 'search' || kind === 'project')
    ? { kind, id: match[2] }
    : undefined
}

export function originParam(origin: Origin) {
  return origin.kind === 'drafts' ? 'drafts' : `${origin.kind}:${origin.id}`
}

// A saved search an item came from, as the browser links to it.
export interface SearchLink {
  publicId: string
  label: string
}

// A row's joined search columns, all null when it wasn't opened from a search.
export interface SearchColumns {
  searchId: string | null
  permit: string | null
  cityName: string | null
  region: string | null
}

export function searchLinkFromColumns(
  row: SearchColumns,
): SearchLink | undefined {
  if (!row.searchId || !row.permit || !row.cityName || !row.region) {
    return undefined
  }

  return {
    publicId: row.searchId,
    label: searchLabel({
      permit: row.permit,
      city: { name: row.cityName, region: row.region },
    }),
  }
}

// How a search is named in breadcrumbs and links: "Fence in Austin, Texas".
export function searchLabel(search: {
  city: { name: string; region: string }
  permit: string
}) {
  return `${search.permit} in ${formatCity(search.city)}`
}
