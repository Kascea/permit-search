import { z } from 'zod'

import type { SearchLink } from '#/lib/navigation/origin'

export type EditorTool = 'text' | 'check' | 'date' | 'signature'

// A box on a PDF page, in PDF points from the page's bottom-left corner.
export interface PdfRect {
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  option?: string
}

// A field the user added on top of the PDF.
export interface PlacedField extends PdfRect {
  id: string
  kind: EditorTool
  value: string
}

export type NativeValue = string | boolean | Array<string>

export interface DraftContent {
  version: 1
  // The PDF's own form fields, keyed by field name. Names stay the same across
  // loads; the editor's field IDs include an index that may not.
  nativeValues: Record<string, NativeValue>
  placedFields: Array<PlacedField>
}

export interface Draft {
  sourceUrl: string
  sourceHash: string
  content: DraftContent
  // The public ID of the saved search the editor was opened from. Stored only
  // when the draft has no search yet.
  searchId?: string
  // ISO time of the last edit, set by the browser that made it. The newer of
  // two copies wins.
  updatedAt: string
}

export interface DraftSummary {
  publicId: string
  title: string
  sourceUrl: string
  updatedAt: string
  search?: SearchLink
}

const MAX_CONTENT_BYTES = 256_000
const MAX_PLACED_FIELDS = 500
const MAX_VALUE_LENGTH = 2_000
const MAX_URL_LENGTH = 2_048
const TOOLS: Array<EditorTool> = ['text', 'check', 'date', 'signature']

function shortString(error: string, max = MAX_VALUE_LENGTH) {
  return z.string({ error }).max(max, error)
}

const formValuesError = 'The draft has invalid form values.'

const nativeValueSchema = z.union(
  [
    z.boolean(),
    shortString(formValuesError),
    z.array(shortString(formValuesError)).max(200, formValuesError),
  ],
  { error: formValuesError },
)

const placedFieldsError = 'The draft has invalid placed fields.'

// z.number() already turns away NaN and Infinity.
const pdfPoint = z.number({ error: placedFieldsError })

const placedFieldSchema = z.object(
  {
    id: shortString(placedFieldsError, 100),
    kind: z.enum(TOOLS, { error: placedFieldsError }),
    value: shortString(placedFieldsError),
    option: shortString(placedFieldsError).optional(),
    pageIndex: pdfPoint.int(placedFieldsError).min(0, placedFieldsError),
    x: pdfPoint,
    y: pdfPoint,
    width: pdfPoint,
    height: pdfPoint,
  },
  { error: placedFieldsError },
)

const formatError = 'The draft format is not supported.'

const draftContentSchema = z
  .object(
    {
      version: z.literal(1, { error: formatError }),
      nativeValues: z.record(
        z.string().max(500, formValuesError),
        nativeValueSchema,
        { error: formValuesError },
      ),
      placedFields: z
        .array(placedFieldSchema, { error: placedFieldsError })
        .max(MAX_PLACED_FIELDS, placedFieldsError),
    },
    { error: formatError },
  )
  .refine(
    (content) => JSON.stringify(content).length <= MAX_CONTENT_BYTES,
    'The draft is too large to save.',
  )

const urlError = 'The draft has an invalid PDF URL.'
const hashError = 'The draft has an invalid PDF hash.'
const dateError = 'The draft has an invalid date.'
const searchError = 'The draft has an invalid search.'

// A draft sent by the browser, or read back from its storage. Each issue's
// message is written for people.
export const draftSchema = z.object(
  {
    sourceUrl: z
      .string({ error: urlError })
      .max(MAX_URL_LENGTH, urlError)
      .regex(/^https?:\/\//, urlError),
    sourceHash: z.string({ error: hashError }).regex(/^[0-9a-f]{64}$/, hashError),
    updatedAt: z
      .string({ error: dateError })
      .refine((date) => !Number.isNaN(Date.parse(date)), dateError),
    searchId: z
      .string({ error: searchError })
      .regex(/^[A-Za-z0-9]{8,16}$/, searchError)
      .optional(),
    content: draftContentSchema,
  },
  { error: 'The draft is missing.' },
)

// "permit-application" from ".../permit-application.pdf?x=1".
export function draftTitle(sourceUrl: string) {
  try {
    const name = new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1)
    const title = decodeURIComponent(name ?? '').replace(/\.pdf$/i, '')

    return (title || new URL(sourceUrl).hostname).slice(0, 200)
  } catch {
    return 'PDF form'
  }
}
