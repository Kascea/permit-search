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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isShortString(value: unknown, max = MAX_VALUE_LENGTH) {
  return typeof value === 'string' && value.length <= max
}

function isPlacedField(value: unknown): value is PlacedField {
  if (!value || typeof value !== 'object') return false
  const field = value as Record<string, unknown>
  return (
    isShortString(field.id, 100) &&
    TOOLS.includes(field.kind as EditorTool) &&
    isShortString(field.value) &&
    (field.option === undefined || isShortString(field.option)) &&
    Number.isInteger(field.pageIndex) &&
    (field.pageIndex as number) >= 0 &&
    [field.x, field.y, field.width, field.height].every(isFiniteNumber)
  )
}

function isNativeValue(value: unknown): value is NativeValue {
  return (
    typeof value === 'boolean' ||
    isShortString(value) ||
    (Array.isArray(value) &&
      value.length <= 200 &&
      value.every((item) => isShortString(item)))
  )
}

// Checks a draft sent by the browser. Returns an error message, or null when
// the draft is safe to store.
export function draftError(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'The draft is missing.'
  const draft = value as Record<string, unknown>

  if (
    !isShortString(draft.sourceUrl, MAX_URL_LENGTH) ||
    !/^https?:\/\//.test(draft.sourceUrl as string)
  ) {
    return 'The draft has an invalid PDF URL.'
  }
  if (
    typeof draft.sourceHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(draft.sourceHash)
  ) {
    return 'The draft has an invalid PDF hash.'
  }
  if (
    typeof draft.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(draft.updatedAt))
  ) {
    return 'The draft has an invalid date.'
  }
  if (
    draft.searchId !== undefined &&
    (typeof draft.searchId !== 'string' ||
      !/^[A-Za-z0-9]{8,16}$/.test(draft.searchId))
  ) {
    return 'The draft has an invalid search.'
  }

  const content = draft.content as Record<string, unknown> | undefined
  if (!content || content.version !== 1) {
    return 'The draft format is not supported.'
  }
  if (JSON.stringify(content).length > MAX_CONTENT_BYTES) {
    return 'The draft is too large to save.'
  }

  const nativeValues = content.nativeValues
  if (
    !nativeValues ||
    typeof nativeValues !== 'object' ||
    Array.isArray(nativeValues) ||
    !Object.entries(nativeValues).every(
      ([name, fieldValue]) => name.length <= 500 && isNativeValue(fieldValue),
    )
  ) {
    return 'The draft has invalid form values.'
  }

  const placedFields = content.placedFields
  if (
    !Array.isArray(placedFields) ||
    placedFields.length > MAX_PLACED_FIELDS ||
    !placedFields.every(isPlacedField)
  ) {
    return 'The draft has invalid placed fields.'
  }

  return null
}

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
