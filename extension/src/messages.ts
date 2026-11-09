import { z } from 'zod'

import type { WebFieldInput } from '#/lib/forms/web-fields'

// What the side panel, the service worker and the reader and filler in the
// portal tab send each other.

// A field on the portal's form, as the reader sees it: what find-fields is
// sent, plus what code needs to fill it. id: the reader's own ID for it, kept
// on the element. width: in CSS pixels.
export interface WebField extends WebFieldInput {
  width: number
  maxLength: number
  isEmpty: boolean
}

// A value to put in a field. A dropdown takes the option whose text or value
// matches the value or one of its alternatives, as "MN" for "Minnesota".
// Session storage key for a tab's origin, recorded when the user clicks the
// extension's icon on it.
export function tabOriginKey(tabId: number) {
  return `origin:${tabId}`
}

export const webFillSchema = z.object({
  fieldId: z.string(),
  label: z.string(),
  value: z.string(),
  alternatives: z.array(z.string()),
})

export type WebFill = z.infer<typeof webFillSchema>

export type ContentRequest =
  | { type: 'read' }
  | { type: 'fill'; fills: Array<WebFill> }
  | { type: 'undo'; fills: Array<WebFill> }

export interface ReadResponse {
  title: string
  fields: Array<WebField>
}

// The fills that were made: only empty fields are filled, and a dropdown with
// no matching option is left alone.
export interface FillResponse {
  filled: Array<WebFill>
}

export type WorkerRequest =
  | { type: 'fill'; tabId: number; projectId: string }
  | { type: 'undo'; tabId: number }

export interface FillResult {
  filled: Array<{ label: string; value: string }>
  // Project values with no field on this page.
  notFound: Array<string>
  // Jev couldn't be asked about the values code left, so notFound is only
  // what code couldn't place.
  jevFailed: boolean
}

export type WorkerResponse =
  | { ok: true; result: FillResult | null }
  | { ok: false; error: string }
