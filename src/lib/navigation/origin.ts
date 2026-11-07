import { formatCity } from '#/lib/location/format'
import { isSearchSlug } from '#/lib/saved-searches/search-key'

// The page a page was opened from, kept in its URL as ?from= so the breadcrumb
// survives reloads and shared links: "search:edina-mn/fence",
// "project:Hn3pQ8rT2wXa" or "drafts".
export type Origin =
  | { kind: 'search'; slug: string }
  | { kind: 'project'; id: string }
  | { kind: 'drafts' }

// The ?from= param's origin, if it names one.
export function parseOrigin(value: string | undefined): Origin | undefined {
  if (value === 'drafts') return { kind: 'drafts' }

  if (value?.startsWith('search:')) {
    const slug = value.slice('search:'.length)

    return isSearchSlug(slug) ? { kind: 'search', slug } : undefined
  }

  const project = /^project:([A-Za-z0-9]{8,16})$/.exec(value ?? '')

  return project ? { kind: 'project', id: project[1] } : undefined
}

export function originParam(origin: Origin) {
  switch (origin.kind) {
    case 'drafts':
      return 'drafts'
    case 'search':
      return `search:${origin.slug}`
    case 'project':
      return `project:${origin.id}`
  }
}

// A saved search an item came from, as the browser links to it.
export interface SearchLink {
  slug: string
  label: string
}

// A search's slug as the params of its /results page.
export function searchRouteParams(slug: string) {
  const separator = slug.indexOf('/')

  return {
    citySlug: slug.slice(0, separator),
    querySlug: slug.slice(separator + 1),
  }
}

// A row's joined search columns, all null when it wasn't opened from a search.
export interface SearchColumns {
  searchSlug: string | null
  permit: string | null
  cityName: string | null
  region: string | null
}

export function searchLinkFromColumns(
  row: SearchColumns,
): SearchLink | undefined {
  if (!row.searchSlug || !row.permit || !row.cityName || !row.region) {
    return undefined
  }

  return {
    slug: row.searchSlug,
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
