import { z } from 'zod'

import type { SearchLink } from '#/lib/navigation/origin'
import { projectSourceUrlSchema, publicIdSchema } from '#/lib/projects/types'

// A blank form in the user's library. It holds no answers; projects fill it.
export interface SavedPermit {
  publicId: string
  title: string
  city: { name: string; region: string }
  // Such as "fence permit", from the search it was saved from.
  permitTypes: Array<string>
  // The city's link, checked again for newer versions.
  sourceUrl: string
  // The stored copy, served at /api/pdf?hash=.
  sourceHash: string
  pageCount: number
  fieldCount: number
  notes: string
  // How many of the user's projects hold this form's link.
  projectCount: number
  search?: SearchLink

  // When the user saved it.
  savedAt: string
  // When the stored copy was last downloaded from the city's link.
  versionSavedAt: string
  // The date written inside the PDF, if any; often its revision date.
  pdfModifiedAt: string | null
}

// A copy older than this may be out of date, and the library says so. Cities
// change forms rarely; a scheduled refresh will keep copies newer than this.
export const STALE_AFTER_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export function isStale(
  permit: Pick<SavedPermit, 'versionSavedAt'>,
  now = Date.now(),
) {
  return now - Date.parse(permit.versionSavedAt) > STALE_AFTER_DAYS * DAY_MS
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
  // The saved search it was found in; its permit types are kept with it.
  searchId: publicIdSchema('search').optional(),
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
