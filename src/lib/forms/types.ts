import type { CheckId } from '#/lib/forms/checks'
import type { FieldRole } from '#/lib/forms/roles'

// Bump when the roles, the ingest questions, or how labels are read change.
// Stored schemas from an older version are rebuilt the next time they're
// needed.
export const FORM_SCHEMA_VERSION = 3

// A box on a page, in PDF points from the page's bottom-left corner.
export interface PageRect {
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

// A run of printed text on one line of a page, as pdf.js reads it. y is the
// baseline.
export interface TextLine extends PageRect {
  text: string
}

export type FormFieldKind = 'text' | 'checkbox' | 'choice' | 'multiple'

// One of the PDF's own form fields, as the checks see it.
export interface FormFieldSchema {
  // The AcroForm name: the key in DraftContent.nativeValues.
  name: string
  kind: FormFieldKind
  // The field's first box.
  rect: PageRect
  // The printed text that names the field, such as "Phone" or "Furnace".
  label: string
  // The heading the field sits under, such as "Contractor", if one was found.
  section: string | null
  // The printed line the field is on, with the field marked, such as
  // "Name: [this field] Email: ___".
  line: string
  // Printed text just above or over the box, often what names a table's cell.
  textAbove: string
  // What the field asks for. Null for checkboxes, and when Jev wasn't sure.
  role: FieldRole | null
  // How sure Jev was of the role, from 0 to 1. Null when there's no role.
  roleProbability: number | null
  // Checkboxes only: whether the box names a kind of work, such as "Deck".
  workType: boolean
  // For city staff to fill in, such as "Permit number" or "Fee".
  officeUse: boolean
  // The form says it must be filled in: the PDF flags the field as
  // required, or Jev reads a marker such as "*" or "(required)" on its
  // line or heading.
  markedRequired: boolean
  // The marking is on the field itself: the PDF's flag or a marker beside it,
  // not just its heading, which may be for a section that doesn't apply.
  markedOnField: boolean
  // Derived from the role and kind in code; stored so a schema can be audited.
  checks: Array<CheckId>
}

// A printed line asking for a signature, such as "Applicant signature: ___".
// Most forms have no field there; the user places a signature on it.
export interface SignatureLine extends PageRect {
  label: string
}

// What a blank form asks for, worked out once per version of the PDF.
export interface FormSchema {
  schemaVersion: number
  sourceHash: string
  title: string
  fields: Array<FormFieldSchema>
  signatureLines: Array<SignatureLine>
  // The page text, for naming fields the user places later.
  lines: Array<TextLine>
}
