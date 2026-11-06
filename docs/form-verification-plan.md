# Form verification plan

A **Check form** button in the editor that uses Jev (TypeSafe) to catch mistakes
before the user downloads a filled permit PDF.

## Status

Built in `src/lib/forms/`, `src/components/FormCheckPanel.tsx` and the editor.
Where the build differs from the plan below:

- **Project as state.** When the form is in a project (or one was chosen in
  the Autofill tab), the project's filled details go to Jev as `project`.
  `matchesProject` applies to every text field: code skips the question when
  a role's project value is the same, and Jev judges the rest, so "Dr" and
  "Drive" match but a different phone number doesn't.
- **Results panel** is a drawer on the right of the editor, not in
  `DraftSidebar`, which stays a file browser.
- **Fields the user places** are named from the stored page text and get
  `valueFitsLabel` and `matchesProject`. Their roles aren't saved on the
  draft yet.
- **`descriptionSpecific`** flags a description when Jev puts at least 0.5 of
  its probability on the vaguest level. The expected score sat near 1 for
  descriptions with one detail, which aren't vague.
- **Required fields.** A field gets the required check when its role is one
  every form needs (see `CHECKS_BY_ROLE`), the PDF flags it as required, Jev reads
  a marker beside its label, or its heading carries one ("Property owner
  *REQUIRED*"). Unit numbers are never made required by a heading. An empty one
  is reported straight away only if the form marks that field itself, or Jev is
  at least 0.7 sure of a role in `ALWAYS_APPLIES_ROLES`. Otherwise Jev is asked
  whether that box applies to this application, and an unsure answer is silent.
  A role alone isn't enough: a table's "Covered patio" cell can read like a
  description of work.
- **Dates.** The `dateCurrent` check flags a signature date more than 7 days
  old or in the future, including dates the user places.
- **Autofill doesn't use roles.** It matches in code from field names and
  printed labels; see [autofill.ts](../src/lib/projects/autofill.ts). The plan
  to improve it is in [autofill-plan.md](autofill-plan.md).
- **Dropdowns, lists and radio buttons** get only the required check.
- **Labels are read on the server** with the pdf.js legacy build, which adds
  about 0.5 MB gzipped to the Worker (2.6 MB in all).

Tested against the live API on St. Louis Park's fence and mechanical forms,
with made-up values. Every planted mistake was caught, and no correct field
was flagged.

## Decisions

- **Run on a button press, not on autosave.** Autosave runs on half-filled
  forms, so it would mostly report "missing" for fields not reached yet, and it
  would repeat calls on every pause. Free code checks (formats) may still show
  inline as the user types.
- **The button sits next to Download** ([editor.tsx](../src/routes/editor.tsx)).
  Download is the app's last step; there is no submit. Download shows a
  non-blocking nudge ("You haven't checked this form yet") and is never locked.
- **Work out the form's structure once per blank PDF, at ingest.** A form's
  structure depends only on the blank PDF, so it is stored per `source_hash`
  (next to `blank_pdfs`, which every user shares) and reused by every draft.
  Checking then just runs the checks the schema lists against the draft's
  values.
- **Roles and checks are defined in code.** Jev chooses a field's role from a
  fixed list. Code maps roles to checks. Jev never invents a role or picks the
  checks.
- **Unsure answers stay unsure.** A Noul between 0.3 and 0.7 gives
  `role: null`, and the field gets only the generic `valueFitsLabel` check.
- **A failed Jev call shows "Check unavailable"**, never "no issues found".

## Why labels come first

Jev needs each field's printed label to judge it. A native field's only name is
its AcroForm name, often `Text12` or `topmostSubform[0].Page1[0].f1_4`. Fields
the user places themselves have no name at all. Neither Jev nor a person can
judge a value from that.

The fix: take the text items from pdf.js `page.getTextContent()`. The nearest
text to the left of or above a field's box is its label. The closest heading
above it is its section ("Contractor Information", "For Office Use Only").

Extract labels on the server from the stored blank PDF, not from labels the
browser sends: the schema is shared by all users, so no browser should be able
to write it.

## Phase 1: ingest (once per `source_hash`)

1. Extract the fields and their boxes. `readNativeFields` in `editor.tsx`
   already does this.
2. Extract each field's label and section from the page's text.
3. Send one Jev request per batch of about 40 fields, to stay under the
   64k-token context limit:
   - a Choice for **what the field asks for**, with the options from
     `FIELD_ROLES`;
   - a companion Noul for **whether any of those roles fits**;
   - a Noul for **whether the field is for office or staff use only**.
4. Code turns the answers into a role per field, then looks up its checks in
   `CHECKS_BY_ROLE`.
5. Save the result as `FormSchema`, in a new `form_schemas` table or a jsonb
   column on `blank_pdfs`, stamped with `schemaVersion`.

Ingest runs in the background when the editor opens a PDF that has no schema
yet. The editor works without a schema; only Check and autofill wait for it.
Bumping `schemaVersion` rebuilds old schemas lazily the next time someone opens
that PDF.

## Phase 2: check (on the button press)

1. Load the schema and read the draft's current values.
2. Run the code checks, which are free and instant.
3. Send the Jev checks in one bundled request, batched like
   `LINKS_PER_REQUEST` in [link-review.server.ts](../src/lib/search/link-review.server.ts).
4. Show the issues in [DraftSidebar.tsx](../src/components/DraftSidebar.tsx),
   grouped by severity. Clicking an issue scrolls to its field and outlines it,
   the way `focusNextEmptyField` does.
5. Results are tied to a hash of the draft's content. Any later edit marks them
   "out of date — check again". Results aren't saved to the database in v1.

Fields the user placed by hand aren't in the blank PDF. They get a role on
their first check, and that role is saved on the draft.

The state sent to Jev contains the form title, the city, the permit from the
search, and the linked project's details, plus each field's label, section,
value and options. Leave out project fields no question uses: an unrelated
field can sway answers.

## Schema types

```ts
// src/lib/forms/roles.ts: what a field can ask for. The descriptions double as
// the Choice criteria sent to Jev.
export const FIELD_ROLES = {
  propertyAddress: { project: 'streetAddress', describe: 'The street address where the work happens' },
  parcelNumber: { project: 'parcelNumber', describe: 'Parcel number, PIN, APN or tax ID' },
  workDescription: { project: 'workDescription', describe: 'A description of the work or project' },
  estimatedCost: { project: 'estimatedCost', describe: 'Valuation or estimated cost of the work' },
  ownerName: { project: 'ownerName', describe: 'The property owner’s name' },
  ownerPhone: { project: 'ownerPhone', describe: 'The property owner’s phone number' },
  // …applicant*, contractor*, contractorLicense
  workTypeOption: { describe: 'A checkbox naming a kind of work, such as Deck, Fence or Re-roof' },
  signature: { describe: 'A signature line' },
  signatureDate: { describe: 'The date next to a signature' },
  other: { describe: 'Anything else the applicant fills in' },
} as const satisfies Record<string, { project?: keyof ProjectDetails; describe: string }>

export type FieldRole = keyof typeof FIELD_ROLES
```

```ts
// src/lib/forms/types.ts: stored per blank PDF.
export interface FormSchema {
  schemaVersion: number // bump to re-ingest every form
  sourceHash: string
  fields: Array<FormFieldSchema>
}

export interface FormFieldSchema {
  name: string // the AcroForm name, the key in DraftContent.nativeValues
  kind: 'text' | 'checkbox' | 'choice' | 'multiple'
  pageIndex: number
  label: string // the printed text, such as "Owner's Phone"
  section: string | null // such as "Property Owner Information"
  role: FieldRole | null // null when Jev wasn't sure
  officeUse: boolean
  checks: Array<CheckId> // derived from role in code, stored for auditing
}
```

## Checks

| Check | Runner | What it catches |
|---|---|---|
| `format.email`, `format.phone`, `format.zip`, `format.money`, `format.date` | Code | Malformed values. |
| `matchesProject` | Code | A value that differs from the linked project after both are normalized. |
| `required` | Code | An empty field the applicant must fill. Uses `officeUse` and whether the field's section applies. |
| `signed` | Code | An empty signature line. |
| `valueFitsLabel` | Jev Noul, per filled field | A value in the wrong box, such as autofill putting the owner's name in the contractor box. "Does `value` answer the form field labeled `label`?" |
| `boxApplies` (input to `required`) | Jev Noul, per empty box | A box that doesn't apply, such as a contractor box for an owner-builder or a unit the project doesn't have. |
| `workTypeMatchesDescription` | Jev Noul, per checked option | "Deck" ticked on a fence permit. "Does `option` describe the work in `project.workDescription`?" |
| `descriptionSpecific` | Jev Score | A vague description of work. Levels range from "names the structure only" to "gives size, materials and location". Cities send applications back for these. |

```ts
// src/lib/forms/checks.ts
export type CheckId =
  | 'format.email' | 'format.phone' | 'format.zip' | 'format.money' | 'format.date'
  | 'matchesProject'
  | 'required'
  | 'signed'
  | 'valueFitsLabel'
  | 'workTypeMatchesDescription'
  | 'descriptionSpecific'

// Every role is listed, so adding a role won't compile until its checks are
// chosen.
export const CHECKS_BY_ROLE: Record<FieldRole, Array<CheckId>> = {
  ownerPhone: ['required', 'format.phone', 'matchesProject', 'valueFitsLabel'],
  ownerEmail: ['format.email', 'matchesProject', 'valueFitsLabel'],
  estimatedCost: ['required', 'format.money', 'matchesProject'],
  workDescription: ['required', 'descriptionSpecific', 'matchesProject'],
  workTypeOption: ['workTypeMatchesDescription'],
  signature: ['signed'],
  signatureDate: ['required', 'format.date'],
  other: ['valueFitsLabel'],
  // …
}

interface CheckDefinition {
  id: CheckId
  runner: 'code' | 'jev'
  // code: returns issues straight away.
  // jev: builds questions, then reads the answers into issues.
}

export const CHECKS: Record<CheckId, CheckDefinition> = { /* … */ }

export interface FieldIssue {
  field: string
  check: CheckId
  severity: 'error' | 'review' | 'missing'
  message: string // written for the user
  score?: number // the Jev probability, for logs
}
```

How answers become severities, with the thresholds from
[link-review.ts](../src/lib/search/link-review.ts):

| Answer | Severity |
|---|---|
| Noul at or below 0.3 on a filled field | `error` |
| Noul between 0.3 and 0.7 | `review` |
| Field empty, and `required` applies | `missing` |
| Otherwise | no issue |

## Files

- `src/lib/forms/roles.ts`: `FIELD_ROLES`.
- `src/lib/forms/types.ts`: `FormSchema`, `FormFieldSchema`.
- `src/lib/forms/checks.ts`: `CheckId`, `CHECKS_BY_ROLE`, `CHECKS`,
  `FieldIssue`.
- `src/lib/forms/questions.ts`: all Jev question wording for both ingest and
  checking, kept in one module like `link-review.ts`.
- `src/lib/forms/labels.server.ts`: label and section extraction.
- `src/lib/forms/ingest.server.ts`: builds and stores `FormSchema`.
- `src/lib/forms/check.server.ts`: a `createServerFn` that validates the draft
  with zod, runs the checks through `createTypeSafeClient()`, logs the payload
  and scores, and uses the existing `rate_limits` table.
- A migration for `form_schemas`.

## Risks

- **Scanned PDFs with no text layer** have no labels. Fallback for later: send
  Jev an image of the page area around the field, since it accepts images and
  the editor already renders the page to a canvas.
- **Flat PDFs with no form fields** have only fields the user places. All of
  their roles are assigned at check time. Fine for v1.
- **The question wording needs tuning** on real forms before it ships.

## Build order

1. Label and section extraction, plus the `form_schemas` table.
2. Ingest (roles and office-use flags). Test it on 4–5 real forms from saved
   drafts, including some with deliberate mistakes. This sends form labels and
   filled-in values, which may include names and phone numbers, to TypeSafe
   using `TYPESAFE_API_KEY`, at a cost of a few cents.
3. Code checks, the Check button, and the sidebar results.
4. The Jev checks.
