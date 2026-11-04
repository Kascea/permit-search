# Online applications plan

Most cities with an online permit portal want permits filed there, not on a
PDF. This plan makes an **online application** a kind of project item
alongside PDF forms. A PDF becomes supplemental: a fallback, or a document
uploaded with the online application.

LOGIS ePermits is the first provider, but nothing in the schema or the UI is
specific to it. Every provider-specific detail lives in a provider adapter or
a `details` jsonb column.

## Status

The catalog, online application items, and the search flow
([search-flow-plan.md](search-flow-plan.md)) are built, for LOGIS. The code
is in `src/lib/portals/` and `src/lib/search/online-applications*.ts`;
migration `0016_portal_catalog.sql`. Where the build differs from the plan
below:

- **`source_url` stays required.** The whole app names a project item by
  its URL (adding, removing, permit numbers, "Saved in"). So every permit
  type has a required, unique `page_url`, and an online item stores it as
  its `source_url`. A provider without a per-type page uses its portal page
  with the type's ID in the fragment. One unique index on (`project_id`,
  `source_url`) covers both kinds.
- **The type's URLs are `page_url` (required), `apply_url` and
  `fee_estimator_url`.** There is no separate `requirements_url`; on LOGIS
  the page is the requirements page.
- **Deferred:** `answers`, `status`, the copied type identity columns, fee
  inputs, and the checklist page. `parent_item_id` is in the table but
  nothing sets it yet.
- **Requirements are documents, notes and links,** plus the declaration.
  LOGIS pages are free-form, so list items become documents and other lines
  notes, and links (such as a deck checklist PDF) are kept as candidates for
  supplemental PDFs.
- **Providers declare `catalog`, `statusLookup` and `submission`.** The
  About page lists them with their cities.

This is the next step toward the product direction in
[ux-redesign-plan.md](ux-redesign-plan.md#where-this-is-going-submitting-through-permit-search):
users prepare a permit once in Permit Search, file it, and eventually submit
it from here.

Research behind it:
- [twin-cities-permit-portals.md](twin-cities-permit-portals.md): which
  metro cities use which portal.
- [permit-tracking-plan.md](permit-tracking-plan.md): how permit numbers are
  tracked today.

## Why

| City pattern | Examples | What the app should lead with |
|---|---|---|
| Online only | Golden Valley, Apple Valley, Maple Grove, Eden Prairie | The online application |
| Online, with a PDF fallback by email or in person | St. Louis Park, White Bear Lake, Crystal | The online application. The PDF is offered as the alternative |
| A PDF uploaded inside the online application | Minnetonka, Eden Prairie sign permits | The online application, with the PDF attached to it |
| PDF only | Minneapolis (mostly), many smaller cities | The PDF form, as today |

Today a permit number can only hang off a PDF form in a project. So a user
who files a St. Louis Park deck permit in ePermits, which has no PDF, has
nothing to attach the number to.

## Concepts

These are kept separate so each provider fills in what it can:

- **Provider:** a permit portal product, such as LOGIS ePermits, Tyler
  EnerGov, Accela, BS&A, OpenGov or CityView.
- **Jurisdiction:** one city or county on a provider, with the provider's own
  code for it (`sl` on LOGIS, a tenant name on EnerGov, an agency code on
  Accela).
- **Portal permit type:** one kind of application a jurisdiction accepts
  online, such as "Residential - Deck" in St. Louis Park. It's catalog data,
  shared by every user.
- **Online application:** a project item that applies for one portal permit
  type for one project. It holds the user's answers, its status, and its
  permit number once filed.
- **PDF form:** a project item for a PDF, as today. It can stand alone, or be
  attached to an online application as supplemental.

What each provider exposes varies, so the schema treats every part of the
catalog as optional:

| Provider | Type list | Type ID | Requirements | Plans required? | Per-type link |
|---|---|---|---|---|---|
| LOGIS ePermits | Public fee estimator list | `permitid` (integer) | Public page per type | In the category name | Requirements and estimator pages |
| Tyler EnerGov | Application Assistant (JSON API) | Case type plus work class (GUIDs) | Varies per city | Varies | Inside a single-page app; not always deep-linkable |
| Accela | Record types | `Building/Residential/Deck/NA` (four-part string) | Varies per agency | Varies | Usually none without signing in |
| BS&A, OpenGov, CityView | Not researched yet | — | — | — | — |

So a type's ID is opaque text, its URLs are all optional, and anything else
goes in `details`.

## Data model

### New: `portal_permit_types`

The catalog. It's shared like `blank_pdfs`, and filled and refreshed by
provider adapters, never by browsers.

```ts
// One kind of application a jurisdiction accepts on its permit portal, such
// as "Residential - Deck" in St. Louis Park. Shared by every user; written
// only by provider adapters.
export const portalPermitTypes = pgTable(
  'portal_permit_types',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),

    // A key of PERMIT_PROVIDERS, such as "logis-epermits".
    provider: varchar('provider', { length: 40 }).notNull(),
    // The provider's code for the city, such as "sl".
    jurisdiction: varchar('jurisdiction', { length: 80 }).notNull(),
    // The provider's own ID for the type, as text whatever its shape: "42"
    // on LOGIS, a GUID pair on EnerGov, "Building/Residential/Deck/NA" on
    // Accela.
    externalId: varchar('external_id', { length: 200 }).notNull(),

    name: varchar('name', { length: 300 }).notNull(),
    // As the portal groups it, such as "Building -Residential (Plans
    // Required)". Null when the portal doesn't group types.
    category: varchar('category', { length: 300 }),
    // Null when the portal doesn't say.
    plansRequired: boolean('plans_required'),

    // What the city asks for, in a shape every provider maps into; see
    // PermitRequirements. Null until read.
    requirements: jsonb('requirements').$type<PermitRequirements>(),
    // Any of these can be missing; see the provider table above.
    applyUrl: varchar('apply_url', { length: 2048 }),
    requirementsUrl: varchar('requirements_url', { length: 2048 }),
    feeEstimatorUrl: varchar('fee_estimator_url', { length: 2048 }),
    // Provider-specific extras that nothing generic reads.
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),

    // When the last refresh still found it. A type the portal drops is kept
    // for applications that use it, but no longer offered.
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('portal_permit_types_external').on(
      table.provider,
      table.jurisdiction,
      table.externalId,
    ),
    index('portal_permit_types_jurisdiction').on(table.provider, table.jurisdiction),
  ],
)
```

```ts
// src/lib/portals/types.ts: what any provider can say a type requires.
export interface PermitRequirements {
  // Uploads, such as "A site plan showing property lines and setbacks".
  documents: Array<{ label: string; detail: string | null }>
  // Short notes such as "Electrical permits are obtained through the state".
  notes: Array<string>
  // The declaration the applicant signs, if the portal shows one.
  declaration: { role: 'owner' | 'contractor'; text: string } | null
  // What the fee estimate asks for, such as valuation within a range.
  feeInputs: Array<{ key: string; label: string; kind: 'money' | 'number' | 'choice'; min?: number; max?: number }>
}
```

### Changed: `project_items`

A project item gets a kind. The UX plan's later rename to `project_forms`
still applies; "item" is used here because that's the current name.

| Column | Change | Notes |
|---|---|---|
| `kind` | New, `'pdf' \| 'online'`, not null, default `'pdf'` | Existing rows are PDFs |
| `source_url` | Becomes nullable | Required for `pdf`, null for `online` (a check constraint) |
| `portal_permit_type_id` | New, references `portal_permit_types`, set null on delete | Required for `online` when created |
| `provider`, `jurisdiction`, `external_type_id` | New, nullable | A copy of the type's identity for `online` items, so the item still names its type if the catalog row goes away |
| `parent_item_id` | New, references `project_items`, cascade | Set on a supplemental PDF attached to an online application |
| `answers` | New, jsonb, default `{}` | Answers an online application needs beyond the project's details, keyed by fill key (see below) |
| `status` | New | `not_started`, `preparing`, `ready`, `submitted`. Statuses after submission come from the tracked permit's phase |

Indexes:
- **Unique** on (`project_id`, `source_url`) where `kind = 'pdf'`. This
  replaces today's unique index.
- **Unique** on (`project_id`, `portal_permit_type_id`) where
  `kind = 'online'`. A project applies for a type once.

`tracked_permits` doesn't change. It hangs off a project item of either
kind. A supplemental PDF doesn't get its own permit; the number belongs to
the application it's attached to.

### Answers use fill keys, not portal fields

An online application's `answers` and a PDF's field mapping share one
vocabulary: the fill keys in `FIELD_ROLES` (`propertyAddress`,
`estimatedCost`, `ownerPhone` and so on), plus keys the provider adds for
type-specific questions (`feeInputs[].key`).

Provider field names never reach the database. This is what makes
submitting through Permit Search possible later. Each provider adapter maps
fill keys to its own form fields when it submits, and the stored data doesn't
change.

## Provider adapters

`src/lib/tracking/` grows into `src/lib/portals/`, one module per provider,
each declaring what it can do:

```ts
// src/lib/portals/providers.ts: shared by the browser and the server.
export interface PortalProvider {
  name: string
  jurisdictions: Array<Jurisdiction>
  capabilities: {
    catalog: boolean // can list permit types
    requirements: boolean // can read what a type requires
    statusLookup: boolean // can read a permit's status by number
    submission: boolean // can submit for the user; false for every provider now
  }
  permitNumberSchema: (jurisdiction: Jurisdiction) => z.ZodType<string>
  applyUrl: (jurisdiction: Jurisdiction) => string
  permitUrl: (jurisdiction: Jurisdiction, permitNumber: string) => string | null
}
```

```ts
// src/lib/portals/adapter.server.ts: server-only. Each method is optional,
// matching the capabilities above.
export interface PortalAdapter {
  listPermitTypes?(jurisdiction: Jurisdiction): Promise<Array<PortalPermitTypeInput>>
  readRequirements?(jurisdiction: Jurisdiction, externalId: string): Promise<PermitRequirements>
  fetchStatus?(jurisdiction: Jurisdiction, permitNumber: string): Promise<PermitStatus>
  // Later; see "Submission" below.
  submit?(application: ApplicationForSubmission): Promise<SubmissionReceipt>
}
```

- **The UI reads capabilities, not provider IDs.** "Check now" shows when
  `statusLookup` is true, and a fee estimate shows when the type has
  `feeInputs`. No component checks `provider === 'logis-epermits'`.
- **Jurisdictions stay in code for now,** as in permit tracking. Move them to
  a table when there are enough of them, or when non-engineers need to edit
  them.

For LOGIS, the adapter reads:
- the type list from `permits/default.aspx?city={code}&estimator=true`,
- requirements from `permits/permitrequirements.aspx?city={code}&permitid={id}`,
- fee inputs from `permits/permitestimator.aspx?city={code}&permitid={id}`.

All three are public. Its robots.txt disallows automated access, so the
catalog refresh stays small (about 14 pages a week) and is mentioned when we
contact LOGIS.

## How it works for the user

1. **Search, in a city with a provider:** the results open with an **Apply
   online** card, for example "St. Louis Park · Residential - Deck · Plans
   required". Jev matches the project description to the jurisdiction's
   permit types; it's the same kind of fixed-choice question it already
   answers for form fields. Web results and PDFs follow, for requirements and
   fallbacks.
2. **Add to project** creates an online application item.
3. **The application page** is a checklist built from `requirements`:
   - Plans required, up front.
   - The documents to upload.
   - The project's details, with copy buttons for pasting into the portal.
   - Type-specific answers, such as valuation, saved to `answers`.
   - A fee estimate, when the type has `feeInputs`.
   - **Apply on St. Louis Park's ePermits**, a link to `applyUrl`.
4. **Supplemental PDFs:** **Attach a PDF form** adds a PDF item under the
   application, filled from the same project, for cities that want it
   uploaded or emailed.
5. **After filing:** the user adds the permit number to the application, and
   tracking works as it does today.

A city with no provider works as it does today: PDF forms, with a permit
number added to the form.

## Submission (later)

Not built now. The schema is shaped so it can be added without migrating
answers:

- **Answers are portal-neutral.** An application's answers are fill keys, so
  a provider's `submit` can map them to that portal's fields.
- **Only sanctioned routes, never stored passwords.** A provider gets
  `submission: true` only through one of these:
  - an official API or a partnership with the portal operator;
  - an agent account the portal provides for third parties, such as
    ePermits' **Plan Submitter** account type;
  - the user's own session, through a browser extension, with the user
    clicking Submit.
- **The user approves every submission.** Submitting shows exactly what will
  be filed, and its fees.
- **Attachments:** a submission includes the application's supplemental
  PDFs, and later uploaded plans. The UX plan's open question on project
  attachments decides where those live.

## Phases

1. **Catalog.**
   - The `portal_permit_types` table, the LOGIS adapter's `listPermitTypes`
     and `readRequirements`, and a weekly refresh.
   - No UI yet. Check the data for 3–4 cities.
2. **Online application items.**
   - The `project_items` changes, the application page, and permit numbers
     on online items.
   - Add online applications from the project page, by picking from the
     city's types.
3. **Search.**
   - The Apply online card and Jev matching.
   - Mark PDFs in provider cities as alternatives.
4. **Supplemental PDFs.** Attach under an application, with filling shared
   with the project.
5. **Second provider: Tyler EnerGov.** It proves the schema isn't shaped
   around LOGIS: GUID type IDs, a JSON catalog, and no per-type URLs.

## Open questions

- **Partial catalogs:** some cities list only some permit types online
  (Crystal: single-family items only). Should the Apply online card say when
  a project's work isn't in the list, so the user turns to the PDF?
- **Keeping requirements current:** a city changes a type's requirements
  without notice. Should an application show the requirements from when it
  was added, or always the latest? Showing the latest with a "changed since
  you started" note seems right.
- **Several types per project:** a deck in some cities needs both a building
  and a zoning permit. Should Jev suggest more than one type at once?
