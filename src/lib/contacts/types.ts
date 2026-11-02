export type OfficeType = 'building' | 'zoning' | 'engineering' | 'general'

export interface OfficeContact {
  officeType: OfficeType
  name: string | null
  phone: string | null
  email: string | null
  streetAddress: string | null
  hours: string | null
  // The page these details were taken from.
  sourceUrl: string | null
}

export interface CityContactsResponse {
  // 'unavailable' when the database isn't configured, such as local development.
  status: 'found' | 'partial' | 'not_found' | 'unavailable'
  primaryOffice: OfficeContact | null
  otherOffices: Array<OfficeContact>
  portalUrl: string | null
  permitsUrl: string | null
  checkedAt: string | null
}

// The office shown first when a city has several.
export const OFFICE_PRIORITY: Array<OfficeType> = [
  'building',
  'general',
  'zoning',
  'engineering',
]

// Lowercase, accents and punctuation removed: "St. Louis Park" and
// "St Louis Park" in "Minnesota" both become "st louis park|minnesota".
export function cityKey(name: string, region: string) {
  return `${normalize(name)}|${normalize(region)}`
}

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
