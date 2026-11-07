import { z } from 'zod'

import type { SearchLink } from '#/lib/navigation/origin'
import type { PortalPermitType } from '#/lib/portals/types'
import { projectSourceUrlSchema, publicIdSchema, searchSlugSchema } from '#/lib/projects/types'
import type { ProjectItem } from '#/lib/projects/types'

// A permit in the user's library: a blank PDF form, or an online permit on
// the city's portal. Neither holds answers; projects fill them.
interface SavedPermitBase {
  publicId: string
  title: string
  city: { name: string; region: string }
  // Such as "fence permit", from the search it was saved from.
  permitTypes: Array<string>
  // The city's link: the PDF, checked again for newer versions, or the
  // online permit's page.
  sourceUrl: string
  notes: string
  // How many of the user's projects hold this permit's link.
  projectCount: number
  search?: SearchLink

  // When the user saved it.
  savedAt: string
  // When the stored copy was last downloaded from the city's link; for an
  // online permit, when it was saved.
  versionSavedAt: string
}

export interface SavedPdfPermit extends SavedPermitBase {
  kind: 'pdf'
  // The stored copy, served at /api/pdf?hash=.
  sourceHash: string
  pageCount: number
  fieldCount: number
  // The date written inside the PDF, if any; often its revision date.
  pdfModifiedAt: string | null
}

// The catalog keeps the permit type current, so it's never stale.
export interface SavedOnlinePermit extends SavedPermitBase {
  kind: 'online'
  online: PortalPermitType
}

export type SavedPermit = SavedPdfPermit | SavedOnlinePermit

// What adding a saved permit to a project sends. An online permit is added by
// its type, as from search results.
export function savedPermitProjectItem(permit: SavedPermit): ProjectItem {
  return {
    sourceUrl: permit.sourceUrl,
    title: permit.title,
    searchSlug: permit.search?.slug,
    portalPermitTypeId: permit.kind === 'online' ? permit.online.id : undefined,
  }
}

// A copy older than this may be out of date, and the library says so. Cities
// change forms rarely; a scheduled refresh will keep copies newer than this.
export const STALE_AFTER_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export function isStale(permit: SavedPermit, now = Date.now()) {
  return (
    permit.kind === 'pdf' &&
    now - Date.parse(permit.versionSavedAt) > STALE_AFTER_DAYS * DAY_MS
  )
}

export const MAX_PERMIT_TITLE_LENGTH = 300
export const MAX_PERMIT_NOTES_LENGTH = 2_000

const permitCitySchema = z.object(
  {
    name: z.string().trim().min(1).max(100),
    region: z.string().trim().min(1).max(100),
  },
  { error: 'Pick the city this form is for.' },
)

const permitTitleSchema = z
  .string({ error: 'Give the permit a title.' })
  .trim()
  .min(1, 'Give the permit a title.')
  .max(MAX_PERMIT_TITLE_LENGTH, 'That title is too long.')

export const savedPermitIdSchema = publicIdSchema('saved permit')

export const savePermitSchema = z.object({
  sourceUrl: projectSourceUrlSchema,
  // A search result's title can be anything, so it's cut to fit.
  title: z
    .string()
    .trim()
    .catch('')
    .transform((title) =>
      (title || 'PDF form').slice(0, MAX_PERMIT_TITLE_LENGTH),
    ),
  city: permitCitySchema,
  // The search it was found in; its permit types are kept with it.
  searchSlug: searchSlugSchema.optional(),
  // For an online permit: its permit type's ID. The server then takes the
  // URL, title and city from the catalog, and sourceUrl is ignored.
  portalPermitTypeId: z.number().int().positive().optional(),
})

export type SavePermitInput = z.output<typeof savePermitSchema>

export const updateSavedPermitSchema = z.object({
  publicId: savedPermitIdSchema,
  title: permitTitleSchema.optional(),
  notes: z
    .string()
    .trim()
    .max(MAX_PERMIT_NOTES_LENGTH, 'Those notes are too long.')
    .optional(),
  city: permitCitySchema.optional(),
})

export type SavedPermitChanges = Omit<
  z.output<typeof updateSavedPermitSchema>,
  'publicId'
>
