# Permit tracking plan

Users file a permit on the city's portal themselves, then add its permit
number to that form in their project. The app checks the permit's status and
shows it next to the form.

LOGIS ePermits is the first provider. Providers are pluggable, so EnerGov and
others can be added later without changing the database or the UI.

Background research is in
[twin-cities-permit-portals.md](twin-cities-permit-portals.md).

Next: [online-applications-plan.md](online-applications-plan.md) lets a
permit number hang off an online application, not only a PDF form. It also
grew `src/lib/tracking/` into `src/lib/portals/`, with provider adapters, each
declaring what it can do (list permit types, read requirements, look up
status, and later submit).

## Status

Phases 1 and 2 are built, for LOGIS only. The code is in `src/lib/portals/`,
[PermitNumberDialog.tsx](../src/components/PermitNumberDialog.tsx) and the
project page. Where the build differs from the plan below:

- **No `checked_at` index yet.** It's only needed for scheduled checks, so
  it's added in phase 3. The status columns are in the table now, so phase 2
  needs no migration.
- **13 LOGIS cities, not 15.** Farmington and New Hope are on the portal but
  have no permit search page (`search.aspx` redirects to their home page), so
  their status can't be looked up.
- **"View permit" links to the permit's own page** on ePermits,
  `permits/permitdetails.aspx?city={code}&permitnbr={number}`. It's public,
  with no sign-in. The search-page postback described in an earlier draft of
  this plan isn't needed.
- **Each provider has an `applyUrl`**, the city's ePermits home page. The
  dialog links to it for people who haven't filed yet.
- **Saving a number checks it straight away,** in the same request, and
  the toast says what it found ("Permit SL306008: Finaled."). After that,
  "Check now" checks again, reusing a check from the last 15 minutes. Both
  go through `limitRequest('permit-check')`.
- **Every check ends in a toast.** The server returns a `PermitCheckResult`
  (changed, unchanged, recent or failed), and `checkToast()` words it, such
  as "No change: permit SL306008 is still Finaled." Stopping tracking and
  removing a form get success toasts too. This is now a rule in DESIGN.md's
  Feedback section.
- **The parser uses string matching, not `HTMLRewriter`,** so it also runs
  in Node against saved pages. It was tested on the live SL306008 page, a
  not-found number, and edited copies for each phase.
- **Local dev trusts one extra root certificate.** epermits.logis.org
  chains to Sectigo Public Server Authentication Root R46. workerd's built-in
  CA list lacks it, so local fetches failed with "internal error" (workerd's
  own log said "TLS peer's certificate is not trusted"). Node, curl and
  browsers trust it. `npm run dev` passes `certs/sectigo-r46.pem` to workerd
  through `NODE_EXTRA_CA_CERTS`. Production Workers can't be given extra CAs,
  so a check from the deployed Worker must be tried before relying on it.
- **The explanation lives in the action flow.** The dialog's hint says the
  city issues the number once the form is filed, and links to the city's
  ePermits for people who haven't filed. The toast after Download says to
  submit the form to the city. The project page has no standing paragraph.

## Decisions

- **Only forms in a project can be tracked.** A form in a project is a
  `project_items` row. The tracked permit is stored on that row, so a draft
  outside a project has nowhere to put one. This comes from the data model,
  not a UI check. Removing the form from its project, or deleting the
  project, deletes its permit too.
- **One permit per form for v1.** One form usually means one application.
  Add support for several permits per form if users ask for it.
- **The user submits; we don't.** No city logins and no stored credentials.
  Looking up a permit by its number on ePermits is public and needs no
  account. See "What direct submission would require" in the portals doc.
- **Providers are defined in code.** The database stores a provider ID as
  text, so adding a provider needs no migration. The code checks the ID
  against the registry.
- **The same zod schema validates the number in the browser and on the
  server.** Each provider builds its schema from the chosen jurisdiction.
- **Status checks start when a user asks, not on a schedule.** LOGIS's
  robots.txt disallows automated access, so scheduled checks wait until
  LOGIS has been asked (phase 3).

## LOGIS permit numbers

Every city's search page masks the number field with a Telerik masked input:
the city's code, then six digits.

| City code | Mask | Example |
|---|---|---|
| `ep` Eden Prairie | `EP______` | |
| `sl` St. Louis Park | `SL______` | `SL306008`, a real 2021 building permit |
| `ed` Edina | `ED______` | |
| `mg` Maple Grove | `MG______` | |
| `av` Apple Valley | `AV______` | |
| `mi` Minnetonka | `MI______` | |
| `wb` White Bear Lake | `WB______` | |
| `ra` Ramsey | `RA______` | |

The mask was read from `RadLiteralMaskPart('EP')` followed by six
`RadDigitMaskPart()` in `search.aspx?city=ep`. The other cities' masks were
checked on November 3, 2026. The codes are the `?city=` values in the
portal's links:

`av, cy, ep, ed, fa, gv, ls, mg, mi, ra, sa, ss, sl, wa, wb`, plus `nh`,
which New Hope's site links to but which isn't on the LOGIS city list.

Normalizing and validating:

1. Trim the input, uppercase it, and remove spaces and dashes, so `sl 306008`
   and `SL-306008` both become `SL306008`.
2. If the input is exactly six digits, add the jurisdiction's prefix, since
   people often leave it off.
3. Match `^{CODE}\d{6}$`. On failure, show an example such as "Edina permit
   numbers look like ED123456."

## Data model

A new table, so `project_items` keeps its current shape:

```ts
// src/lib/db/schema.ts
// The city permit filed for a form in a project, and its last known status.
export const trackedPermits = pgTable(
  'tracked_permits',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    projectItemId: bigint('project_item_id', { mode: 'number' })
      .notNull()
      .references(() => projectItems.id, { onDelete: 'cascade' }),

    // A key of PERMIT_PROVIDERS, such as "logis-epermits".
    provider: varchar('provider', { length: 40 }).notNull(),
    // The provider's code for the city, such as "sl".
    jurisdiction: varchar('jurisdiction', { length: 40 }).notNull(),
    // Normalized by the provider's schema, such as "SL306008".
    permitNumber: varchar('permit_number', { length: 40 }).notNull(),

    // Null until the first successful check.
    status: jsonb('status').$type<PermitStatus>(),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    // When status last differed from the check before it.
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }),
    // The last check's failure, written for the user; cleared on success.
    checkError: varchar('check_error', { length: 300 }),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('tracked_permits_project_item').on(table.projectItemId),
    // For scheduled checks in phase 3.
    index('tracked_permits_checked_at').on(table.checkedAt),
  ],
)
```

This needs a migration, `0015_tracked_permits.sql`, generated with
`npm run db:generate`.

`listProjects` adds the permit to each item's JSON with a left join, so the
project page gets it without another request:

```ts
// src/lib/projects/types.ts
export interface ProjectItem {
  // …existing fields
  // Read back: the permit filed for this form, if one was added.
  permit?: TrackedPermit
}
```

## Provider registry

The registry is split in two, so scraping code never reaches the browser
bundle.

```ts
// src/lib/portals/providers.ts: shared by the browser and the server.
export interface Jurisdiction {
  code: string // the provider's code, such as "sl"
  city: { name: string; region: string } // matched to the project's city
}

export interface PermitProvider {
  name: string // "LOGIS ePermits"
  jurisdictions: Array<Jurisdiction>
  // Normalizes and validates a number for one city.
  permitNumberSchema: (jurisdiction: Jurisdiction) => z.ZodType<string>
  placeholder: (jurisdiction: Jurisdiction) => string // "SL123456"
  // Where the user files with the city; we never file for them.
  applyUrl: (jurisdiction: Jurisdiction) => string
  // The permit's own page on the portal.
  permitUrl: (jurisdiction: Jurisdiction, permitNumber: string) => string
}

export const PERMIT_PROVIDERS = {
  'logis-epermits': logisEpermits,
} as const satisfies Record<string, PermitProvider>

export type PermitProviderId = keyof typeof PERMIT_PROVIDERS

// The provider and city for a project's city, or null. Used to preselect
// them in the dialog.
export function providerForCity(city: Project['city']) { /* … */ }
```

```ts
// src/lib/portals/providers.server.ts: only the server fetches status.
export interface PermitStatusFetcher {
  fetchStatus(jurisdiction: Jurisdiction, permitNumber: string): Promise<PermitStatus>
}

// Every provider must have a fetcher, or this won't compile.
export const STATUS_FETCHERS: Record<PermitProviderId, PermitStatusFetcher> = {
  'logis-epermits': logisStatusFetcher,
}
```

The status is stored in a shape every provider maps into:

```ts
// src/lib/portals/types.ts
export type PermitPhase =
  | 'applied' | 'approved' | 'issued' | 'finaled'
  | 'cancelled' | 'expired' | 'unknown'

export interface PermitStatus {
  phase: PermitPhase // worked out by the provider; 'unknown' when unsure
  label: string // for people, such as "Approved, fees due"
  permitType: string | null
  description: string | null
  dates: {
    applied: string | null // ISO dates
    approved: string | null
    issued: string | null
    finaled: string | null
    cancelled: string | null
    expires: string | null
  }
  balanceDueCents: number | null // unpaid application and permit fees
}

export interface TrackedPermit {
  provider: PermitProviderId
  jurisdiction: string
  permitNumber: string
  status: PermitStatus | null
  checkedAt: string | null
  checkError: string | null
  permitUrl: string // so the UI can link to it without the registry
}
```

Input validation is a discriminated union on `provider`. Adding a provider
adds a branch.

```ts
export const trackedPermitInputSchema = z
  .object({
    provider: z.enum(Object.keys(PERMIT_PROVIDERS)),
    jurisdiction: z.string(),
    permitNumber: z.string(),
  })
  .transform((input, ctx) => {
    // Look up the provider and jurisdiction, adding an issue when either is
    // unknown, then parse permitNumber with permitNumberSchema(jurisdiction).
  })
```

## Server functions

These go in `src/lib/portals/tracking.ts`. They follow `projects.ts`:
`withUserDatabase`, `parseUserInput`, and each change returns the updated
project list. Items are identified by project `publicId` plus `sourceUrl`,
the same way `removeFromAccountProject` does it.

| Function | What it does |
|---|---|
| `setProjectItemPermit` | Validates the input and upserts on `project_item_id`. It joins through `projects` with `ownedBy`, so a form that isn't in one of the user's projects matches no row and nothing is saved. Changing the number clears the stored status. |
| `removeProjectItemPermit` | Deletes the permit row. |
| `checkProjectItemPermit` | Fetches the status now and stores it. Uses `limitRequest('permit-check', headers)`. Returns the cached status instead if it was checked less than 15 minutes ago. |

## LOGIS status fetcher

Each permit has a public page, with no sign-in, cookies or form posts:

```
https://epermits.logis.org/permits/permitdetails.aspx?city=sl&permitnbr=SL306008
```

`src/lib/portals/logis.server.ts` fetches it with Workers `fetch` and reads
it with `HTMLRewriter`. It needs no new dependencies.

### What the page shows

Every value is a label and field pair under a section heading:

```html
<div class="detail-view"><h2>Assigned Dates</h2>
  <div class="detail-row">
    <div class="detail-label">Applied Date:</div>
    <div class="detail-field">3/17/2021</div>
  </div>
  …
```

| Section | Labels |
|---|---|
| Property Information | PID, Address |
| Permit Information | Permit #, Permit Type, Sub Type, Work Type, Description |
| Assigned Dates | Applied, Issued, Approved, Final, Cancel, Dead, Refund and Expiration Date. Blank when not reached. |
| Application Fees, Permit Fees | Total Fees, Total Payments, Outstanding Balance |
| Permit Valuation | Valuation |

- **No status field.** The phase is worked out from the dates.
- **Unknown numbers:** a number that doesn't exist still returns HTTP 200,
  with "Permit SL999999 could not be found." in place of the details.
- **No inspections.** Inspection results aren't on this page; they're
  reached through the search page. They can be added later.

### Working out the phase

The first rule that matches wins:

| Rule | Phase | Label |
|---|---|---|
| Cancel Date or Dead Date set | `cancelled` | Cancelled |
| Final Date set | `finaled` | Finaled |
| Expiration Date in the past | `expired` | Expired |
| Issued Date set | `issued` | Issued |
| Approved Date set, fees owed | `approved` | Approved, fees due |
| Approved Date set | `approved` | Approved |
| Applied Date set | `applied` | In review |
| Otherwise | `unknown` | Status unknown |

For example, `SL306008` was applied for on 3/17/2021, approved on 4/6,
issued on 4/7 and finaled on 6/24/2021, so it reads as `finaled`. It's an
exterior siding job at 4132 Vernon Ave S.

"Dead" probably means the city closed the application without a permit. It
reads as cancelled until a real dead permit shows otherwise. The fees owed is
the sum of both Outstanding Balances.

### Errors

- **"Could not be found":** stored as the check error "ePermits has no
  permit SL306008. Check the number and city."
- **A page without the "Assigned Dates" section,** or another unexpected
  page, throws a `PortalChangedError`. It's stored as "Couldn't read the
  status from ePermits right now" and logged with the city, but never the
  permit number.
- **A failed request:** keeps the last good status and stores the error.

Requests send a user agent naming the app, with a contact URL.

### Testing

Save the SL306008 page and a not-found page as fixtures, and build the
parser against them. The repo has no test runner yet. Adding Vitest for
these parsers is the smallest useful step. To find more permits to test
with, search by address on a city's `search.aspx` page.

## UI

On the project page's Forms list ([projects.$projectId.tsx](../src/routes/projects.$projectId.tsx)):

- **No permit yet:** an "Add permit number" link on the row, next to Fill
  and Remove.
- **The dialog** reuses [Modal.tsx](../src/components/Modal.tsx) and has
  three parts:
  - **Provider:** preselected by `providerForCity(project.city)`. When the
    city has no provider, say tracking isn't available for that city yet.
  - **City:** shown only when the provider covers more than one. Preselected
    from the project.
  - **Permit number:** a text field with the mask as its placeholder
    (`SL123456`). It is validated as the user types, with the same schema as
    the server, and the error shows inline.
- **With a permit:** a second line on the row shows the number, the status
  label and when it was last checked, for example "SL306008 · Issued ·
  checked 2 hours ago". It also has "Check now", "View on ePermits" (a link
  to `permitUrl`), and edit and remove actions.
- **When a check fails:** show `checkError` in a `Notice`, keeping the last
  good status visible.

The editor gets nothing in v1. Permits are added from the project, where the
rule that only forms in projects can be tracked is easy to see.

## Phases

1. **Store and validate.**
   - The table, the migration, the provider registry with LOGIS's
     jurisdictions and schema, the set and remove server functions, the
     dialog, and the "View on ePermits" link.
   - This works without any scraping.
2. **Check on demand.**
   - The LOGIS fetcher, `checkProjectItemPermit`, the "Check now" button,
     and showing the status.
   - Test it against a real permit number from each of 3–4 cities.
3. **Scheduled checks and change alerts.**
   - First, ask LOGIS for permission or a data feed. Its robots.txt
     disallows automated access.
   - With permission, add a Cron Trigger. That needs a custom Worker entry
     exporting `scheduled` next to Start's `fetch`, in place of
     `@tanstack/react-start/server-entry` in
     [cloudflare.config.ts](../cloudflare.config.ts).
   - It checks open permits (not `finaled`, `expired` or `denied`) about
     once a day, oldest `checkedAt` first, with a few seconds between
     requests.
   - A changed status sets `statusChangedAt`, and the project shows it as
     new. Email alerts come later.
4. **Next provider: Tyler EnerGov.**
   - Add a jurisdiction list (St. Paul, Woodbury, Shakopee, Cottage Grove,
     Columbia Heights), a number schema, and a fetcher using the JSON search
     API from the portals doc.
   - EnerGov numbers vary by city (for example `DSIMECR-057331-2026` in St.
     Paul), so its schema may be a looser pattern per city.

## Files

- `src/lib/db/schema.ts`: `trackedPermits`.
- `drizzle/0015_tracked_permits.sql`.
- `src/lib/portals/types.ts`: `PermitStatus`, `PermitPhase`,
  `TrackedPermit`.
- `src/lib/portals/providers.ts`: `PERMIT_PROVIDERS`, `providerForCity`,
  `trackedPermitInputSchema`.
- `src/lib/portals/logis.ts`: LOGIS jurisdictions, number schema and
  `applyUrl` and `permitUrl`. Shared by the browser and the server.
- `src/lib/portals/logis.server.ts`: the LOGIS status fetcher.
- `src/lib/portals/providers.server.ts`: `STATUS_FETCHERS`.
- `src/lib/portals/tracking.server.ts`: database reads and writes.
- `src/lib/portals/tracking.ts`: server functions.
- `src/lib/projects/projects.server.ts`: join the permit into
  `listProjects`.
- `src/components/PermitNumberDialog.tsx` and
  `src/components/TrackedPermitLine.tsx`.
- `src/routes/projects.$projectId.tsx`: use both components on the Forms
  list.

## Open questions

- **A "Not listed" provider** that stores any number without status checks,
  so users in unsupported cities can still record it. It's cheap to add, but
  forms would show a number with no status.
- **When to contact LOGIS:** before phase 2 ships, or only before phase 3.
  On-demand checks are a few requests per user action, but they still go
  against its robots.txt.
- **Electrical permits** in LOGIS cities are often state (DLI) permits, not
  city ones, and won't be found on ePermits. Should the dialog mention this
  when the form is an electrical permit?
