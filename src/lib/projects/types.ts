import { UserError } from '#/lib/errors'

// A PDF saved to a project.
export interface ProjectItem {
  sourceUrl: string
  title: string
}

export interface Project {
  publicId: string
  name: string
  // The city of the search it was started from, if any.
  city: { name: string; region: string } | null
  // Newest first.
  items: Array<ProjectItem>
}

export const MAX_PROJECT_NAME_LENGTH = 120
const MAX_URL_LENGTH = 2_048
const MAX_TITLE_LENGTH = 300

const PUBLIC_ID = /^[A-Za-z0-9]{8,16}$/

export function validatePublicId(value: unknown, what = 'project') {
  if (typeof value !== 'string' || !PUBLIC_ID.test(value)) {
    throw new UserError(`That ${what} is not valid.`)
  }
  return value
}

export function validateProjectName(value: unknown) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) throw new UserError('Give the project a name.')
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw new UserError('That project name is too long.')
  }
  return name
}

export function validateProjectCity(value: unknown): Project['city'] {
  if (value === null || value === undefined) return null
  const city = value as Record<string, unknown>
  if (
    typeof city.name !== 'string' ||
    typeof city.region !== 'string' ||
    city.name.length > 100 ||
    city.region.length > 100
  ) {
    throw new UserError('That city is not valid.')
  }
  return { name: city.name, region: city.region }
}

export function validateProjectItem(value: unknown): ProjectItem {
  const item = (value ?? {}) as Record<string, unknown>
  if (
    typeof item.sourceUrl !== 'string' ||
    item.sourceUrl.length > MAX_URL_LENGTH ||
    !/^https?:\/\//.test(item.sourceUrl)
  ) {
    throw new UserError('That PDF link is not valid.')
  }
  const title = typeof item.title === 'string' ? item.title.trim() : ''
  return {
    sourceUrl: item.sourceUrl,
    title: (title || 'PDF form').slice(0, MAX_TITLE_LENGTH),
  }
}
