import { formatCity } from '#/lib/location/format'

// The page a page was opened from, kept in its URL as ?from= so the breadcrumb
// survives reloads and shared links: "search:k7Qm2xPz9aB4",
// "project:Hn3pQ8rT2wXa" or "drafts".
export type Origin =
  | { kind: 'search' | 'project'; id: string }
  | { kind: 'drafts' }

// For validateSearch: the param if it names an origin, else nothing.
export function parseOrigin(value: unknown): Origin | undefined {
  if (value === 'drafts') return { kind: 'drafts' }
  if (typeof value !== 'string') return undefined
  const match = /^(search|project):([A-Za-z0-9]{8,16})$/.exec(value)
  return match
    ? { kind: match[1] as 'search' | 'project', id: match[2] }
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

// How a search is named in breadcrumbs and links: "Fence in Austin, Texas".
export function searchLabel(search: {
  city: { name: string; region: string }
  permit: string
}) {
  return `${search.permit} in ${formatCity(search.city)}`
}
