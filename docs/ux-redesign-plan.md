# UX redesign plan

Permit Search changes from a search box with extras into a permit workspace.
Search stays, but it becomes one way into a loop: **find a permit → save the
blank form → add it to a project → auto-fill it → check it → mark it ready.**

Three changes do most of the work:

- **A permit library of blank forms.** Each user has their own library of
  saved permits, sorted and filtered by city. A saved permit is the empty PDF
  (a stored copy plus its source link), its city and permit types, and which
  of its fields take which kind of answer. It never stores answers, because
  each project has its own address, contractor and scope. Any saved permit can
  be brought into any project.
- **A dashboard, with search always at hand.** Signed-in users land on a
  dashboard of their projects, forms and saved permits. Searching starts from
  the top bar's search box on every page, which keeps the current search
  until it's cleared. Past searches are on `/history`.
- **Your info, entered once.** The user's own details (name, phone, email,
  mailing address, and company and license for contractors) live on their
  account. A project uses them wherever the user plays a role on it.
- **Answers flow down, one layer at a time.** My info fills the project, the
  project fills each form, and the form is checked before it's marked ready.
  Each answer shows where it came from, and an edit stays where it was made
  unless the user chooses to save it higher up.

The visual style in [DESIGN.md](../DESIGN.md) doesn't change.

## Where the app is today

Most of the parts already exist, but each one sits on its own page and the
data doesn't carry from one to the next.

| Area          | Today                                                                                                                       | Gap                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Search        | `/` and `/results` run a Tavily search; Jev names the permit types; results are cached in `searches`                         | Results can't be saved on their own; a result has to go into a project or into the editor                                 |
| Projects      | `/projects/$id` holds the property, scope, owner, applicant and contractor as fixed columns on `projects`, plus `extra_fields` | The user's own name, phone and license are retyped for every project                                                     |
| Project forms | `project_items` stores a PDF URL and title per project                                                                      | The same permit used in two projects is two unrelated rows; there's no status                                            |
| Drafts        | `pdf_drafts` is unique per user and source URL; `/drafts` lists them                                                        | Filling the same city form for two projects overwrites one draft                                                         |
| Auto-fill     | `autofill.ts` guesses from PDF field names ("OwnerPhone") and fills empty text fields only                                  | Nothing remembers a correction; checkboxes, dates and unmatched fields are left to the user; no record of what was filled |
| Checking      | None                                                                                                                        | Users can't tell whether a form is complete before they submit it                                                        |
| Navigation    | Header links: Projects, Drafts, History; a search pill opens the search modal                                               | Built around search; there's no home that shows what needs attention                                                     |

## The three layers

Every answer on a form belongs to exactly one layer. A layer below can use an
answer from the layer above, or replace it with its own.

```
 ┌──────────────────────────────────────────────────────────────┐
 │ MY INFO  (account, entered once)                             │
 │ name, phone, email, mailing address, company, license        │
 └──────────────────────────────┬───────────────────────────────┘
                                │ used for each role the user plays:
                                │ owner, applicant, contractor
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ PROJECT  (one job)                                           │
 │ property address, parcel, scope, cost, and the other people  │
 │ (an owner or contractor who isn't the user)                  │
 └──────────────────────────────┬───────────────────────────────┘
                                │ fills each form in the project
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ PROJECT FORM  (one blank permit in one project)              │
 │ the draft, where each answer came from, check results, status│
 └──────────────────────────────▲───────────────────────────────┘
                                │ the blank form + its field mapping
 ┌──────────────────────────────┴───────────────────────────────┐
 │ SAVED PERMIT  (user's library, blank PDF, no answers)        │
 │ stored blank PDF, form link, city, permit types, PDF hash,   │
 │ field mapping: "OwnerPhone" → owner's phone                  │
 └──────────────────────────────────────────────────────────────┘
```

The rules that make this predictable:

1. **A saved permit holds no answers.** Its field mapping says what kind of
   answer each field takes ("owner's phone", "parcel number"), never the
   answer itself. The same blank permit can go into any number of projects.
2. **Inherited answers stay linked.** When a project uses My info for a role,
   it reads those values live. Fix a typo in your phone number once and every
   linked project picks it up.
3. **Edits stay where they're made.** Changing an answer in a form changes
   that form only. Changing it on the project changes the project only. The
   user can push an answer up with an explicit "Save to project" or "Save to
   my info".
4. **Ready forms are frozen.** Once a form is marked ready or submitted,
   later changes to My info or the project don't touch it. The user sees a
   notice and can reopen the form to take the new values.
5. **The source is always visible.** Every filled field carries a small source
   tag: _My info_, _Project_, or _Typed here_.

## Workflow: bringing answers down

### 1. Set up My info (once)

1. The first time a signed-in user creates a project or opens a form, a short
   panel asks for their info. It's skippable and can be finished later in
   `/me`.
2. It starts with one question, **"How do you usually work on permits?"**:
   homeowner, contractor, or other (designer, expediter). The answer picks the
   fields shown. A contractor sees company and license, and a homeowner sees
   their home address. It also sets the default role on new projects.
3. Fields: name, phone, email, mailing address, and for contractors company,
   license number and license type. Users can add labelled extras such as
   "Contractor bond number", and those can fill forms like project extras do
   today.

### 2. Find and save a blank permit

1. The user searches from the top bar's search box (or the landing page's
   form when signed out) by city and project description, as today.
2. Each result shows **Save permit** next to "Fill out this form" and "Add to
   project".
3. Saving fetches the PDF and stores a blank copy, keyed by its SHA-256 hash.
   The library entry keeps the city, the permit types Jev found, and the
   search it came from. No answers are stored.
4. "Add to project" saves to the library first, then attaches it.
5. A PDF opened in Quick fill has a **Save to my permits** action, so a form
   found outside search can join the library too. The user picks the city.

### 2a. Bring a saved permit into a project

Permits move into projects from either side:

- **From the project:** **Add permit** opens the library picker, filtered to
  the project's city. A "Show all cities" toggle widens it.
- **From the library:** each saved permit has **Add to project**, which lists
  the user's projects in that city first.

Adding a permit creates a project form that starts blank and fills from the
project as soon as it opens. Adding the same permit to a second project gives
it a second, separate project form.

### 3. Start a project

The new-project form asks only what changes from job to job. My info covers
the rest.

1. **Where:** city and street address. A homeowner sees **"At my address"**
   checked by default, which links the property to My info. Parcel number and
   extras (lot, zoning) are per project.
2. **Your role:** checkboxes for owner, applicant and contractor, preset from
   the My info answer. Each checked role shows as a linked card: "Owner · From
   your info · Jane Doe, (612) 555-0142". The card has two actions: **Edit my
   info** and **Use someone else**.
3. **Other people:** each role the user didn't check gets a short inline form
   (name, phone, email, and company and license for a contractor), saved on
   the project.
4. **The work:** description and estimated cost.
5. **Permits:** the library picker, with saved permits for this city first,
   then **Search for a new one** with the city already set.

### 4. Fill a form

1. Opening a project form fills its empty fields. The value for each field is
   resolved in this order:
   1. something the user typed in this form
   2. the project's answer
   3. My info, for a role the user plays on this project
2. The fields are matched first by the saved permit's field mapping, then by
   name guessing (today's `autofill.ts`), then by a Jev suggestion the user
   confirms.
3. The **Fill** tab shows "Filled 22 of 31 fields". Below that is a list of
   filled fields with their source tags, followed by the fields still unplaced.
4. An unplaced field has two actions:
   - **Assign:** pick what it takes ("Contractor license"). This saves to the
     blank permit's field mapping, so the next project fills it too.
   - **Answer here:** type a value for this form only.
5. When the user types an answer that the project or My info is missing, the
   field offers **Save to project** or **Save to my info**. For example, they
   type a parcel number and the project has none. Nothing moves up unless they
   choose it.

### 5. Keep forms in step

1. Editing the project refreshes its open forms. Fields that were filled and
   not changed in the form take the new value. Fields typed in the form keep
   their value.
2. Editing My info does the same for every project that links it. A toast
   names how many forms were updated.
3. Forms marked ready or submitted aren't changed. They show a notice: "Your
   phone number changed since this form was marked ready. **Update and
   recheck**".

### 6. Check and mark ready

1. The **Check** tab runs on every save, and on demand.
2. Results are grouped into **Must fix**, **Review** and **Looks good**.
   Each item jumps to its field.
3. With nothing left under Must fix, the user can **Mark ready**. The project
   shows "3 of 4 forms ready".

## Navigation and routes

Signed-in pages sit in an app shell with a left sidebar (`AppSidebar`, from
the lg breakpoint up), and a top bar across the page area:

- **Sidebar:** the logo, then **Dashboard, History, Projects, My permits,
  Forms**. The five most recent projects sit under Projects on a faint margin
  rule, the current one marked in blueprint. A caret folds them away.
  Right-clicking Projects offers New project; right-clicking a project
  offers Open and Delete project. At the foot is only the account row, whose
  menu opens upward with **My info**, **Settings**, **About**, **Contact us**
  and **Sign out**.
- **Top bar:** 64px tall, so its bottom rule meets the one under the sidebar
  logo on a grid line. It holds the search box on the right, the one place
  to start a search. The box shows the current search (city and project),
  kept in the browser and the same on every page until it's cleared with its
  ×. Viewing a search's results makes that search current. The box opens
  the search modal, starting from it.

From lg up, signed-in pages have no footer, so the page is open canvas. The
sidebar is see-through and the top bar draws the same fixed grid, so the
grid runs edge to edge. The footer's "confirm with your permitting office"
notice is on the results page, where it applies. Below lg, the header
returns with the logo and account menu, and the footer returns. The editor
keeps its own full-window toolbar and has no sidebar. Signed-out pages keep
the header, with a **Drafts** link, and the footer.

Every page but the editor uses one frame, `AppPage`. Signed in, from lg up,
it centers the page's column beside the sidebar, rounding the offset down to
whole grid cells so its edges stay on grid lines. The column is 24 cells wide
(35 for wide pages such as results) and starts two cells below the top bar.
Signed out, the column is centered.

| Section        | Route                                                  | Replaces                             | What it holds                                                                                |
| -------------- | ------------------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Dashboard      | `/`                                                    | `/`                                  | Signed in: the dashboard. Signed out: the landing page, the search form                      |
| History        | `/history`                                             | same                                 | The user's past searches. Searching starts from the top bar                                  |
| Search results | `/search/results`, `/search/results/$searchId`         | `/results`, `/results/$searchId`     | Today's results page, with Save permit on every result                                       |
| My permits     | `/permits`                                             | none                                 | The user's library of blank permits, grouped and filtered by city                            |
| Saved permit   | `/permits/$permitId`                                   | none                                 | The blank PDF, its city and types, its field mapping, and the projects using it              |
| Projects       | `/projects`, `/projects/$id`                           | same                                 | Project list; a project page with tabs for Overview, Forms, and Details                      |
| Project form   | `/projects/$id/forms/$formId`                          | `/editor?url=` opened from a project | The editor, tied to one project                                                              |
| My info        | `/me`                                                  | none                                 | The user's info, with the projects that link it                                              |
| Forms          | `/forms`                                               | `/drafts`                            | Every form in progress across projects, plus loose drafts                                    |
| Quick fill     | `/editor?url=`                                         | same                                 | Kept for signed-out users and one-off forms. Signed in, it can still fill from My info       |

Old URLs redirect: `/results*` → `/search/results*`, `/search` → `/`,
`/drafts` → `/forms`.

## Screen-by-screen changes

**Dashboard ("What's next").** A to-do list built from the user's data, not
a copy of the other pages. Past searches stay on `/history`, and saved
permits on `/permits`. A next step that needs a search opens the top bar's
search modal.

- _Continue:_ the form edited last, with its project, and **Resume**.
- _Your projects:_ each project with its progress and its one next step,
  worked out in `src/lib/dashboard/next-steps.ts`, in this order:
  1. Add the property address
  2. Find a permit (runs a search for the project's city and work)
  3. Start the first form not yet started
  4. Keep filling the most recently edited form

  Later phases add steps ahead of these: finish My info (phase 4), fix a form
  with Must fix items, update a ready form whose info changed, and replace a
  permit the city updated (phase 6). Once checks exist, the progress bar
  counts ready forms instead of started ones.
- _Forms not in a project:_ drafts whose PDF is in no project, each with
  **Add to project**.

There is one primary button, **New project**. A user with no projects or
drafts sees a three-step start instead.

**History.** The user's past searches as a ruled list, each removable.

**My permits.** The user's library of blank forms.

- Grouped under city headings by default, such as "Minneapolis, Minnesota ·
  6 permits". Within a city, permits are sorted by title.
- Controls along the top: a city filter (the existing `CityCombobox`, limited
  to the cities in the library), permit type chips, and a text filter on
  title. A sort menu offers City, Recently used, Most used and Title. Every
  choice is kept in the URL, as in
  `/permits?city=Minneapolis&region=Minnesota&sort=recent`.
- Each row shows the title, permit type badges, the PDF's page count, how
  many projects use it, and when it was last checked against the city's
  site. Actions: **Add to project**, **Fill once** (Quick fill), and the
  overflow menu with Rename, Check for a new version, and Remove.
- A replaced form shows a redline "City posted a new version" badge.

**Project page.**

- **Overview:** address, scope, a card for each role (linked cards show _From
  your info_), and the forms checklist with statuses.
- **Forms:** one row per project form with title, status badge, Must fix
  count, and last edited. **Add permit** opens the library picker.
- **Details:** today's `ProjectForm`, restructured into the steps of workflow
  3. Linked roles are read-only cards, and **Use someone else** unlinks one.

**Editor.** A separate, full-window screen, built from the app's parts:

- **Left panel:** framed like `AppSidebar` (logo, 8 cells wide, the account
  row at the foot) but styled as a file browser on plain paper, since these
  are PDF files: a Dashboard link back, then projects as folders (caret, open
  or closed folder icon, file count) with their PDFs indented under them on a
  faint guide, and a Drafts folder for forms not in a project. The open PDF is
  selected; each PDF shows when it was last edited.
- **Top bar,** two cells tall, its rule running on from the sidebar's: the
  breadcrumb and title, then Fill from project, save status and Download.
- **Tool palette:** the second row, floating at the top of the desk and
  staying as the pages scroll: the field tools, zoom, pages and next-empty.
  The placement hint and draft notices stack under it.
- **Desk:** the page grid a shade darker (`bg-desk`), with white PDF pages.
- **Right panel (later):** a closeable panel for the Fill and Check tabs
  below, so the forms stay on the left and everything about the open form
  is on the right.

The right panel's tabs:

- **Fill:** replaces `ProjectFillMenu`. It has the fill count, filled fields
  with source tags, unplaced fields with Assign and Answer here, and the
  Save-up prompts. On the page, a filled field shows a faint blueprint
  underline. Hovering it shows its source.
- **Check:** the checks, in the order they're built:
  1. _Required:_ fields the PDF marks required, labels with an asterisk, and
     fields marked required in the mapping.
  2. _Format:_ phone, email, ZIP, parcel pattern per city, cost in whole
     dollars, real dates.
  3. _Matches the project:_ a typed value that conflicts with the project or
     My info, such as an address that isn't the property's.
  4. _Sign and date:_ empty signature and date fields, under Review, because
     some are signed on paper.
  5. _Current form:_ the PDF's hash differs from the saved permit's.
  6. _Plain-language checks with Jev:_ such as whether the work description
     says what's being built and where. Always under Review.
- (Moving between forms stays in the left sidebar, `DraftSidebar`.)

**Saved permit page.** The blank PDF preview, and the field mapping as a table
("PDF field → takes"), which can be edited. It shows the projects using the
permit, but no answers.

**My info.** The setup fields from workflow 1, plus a list of the projects
that link to it. Saving shows how many open forms will update.

## Data model and backend changes

The plan adds four tables, changes three, and adds an R2 bucket for blank
PDFs. Project answers stay in today's
`projects` columns. Each role gains a flag that says whether it's linked to My
info.

| Table                             | Change              | Key columns                                                                                                                                                                                                       |
| --------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_profiles`                   | New                 | `user_id` (primary key), `work_type` (homeowner, contractor, other), `name`, `phone`, `email`, `street_address`, `unit`, `city_name`, `city_region`, `zip_code`, `company`, `license_number`, `license_type`, `extra_fields` jsonb |
| `blank_pdfs`                      | New                 | `source_hash` (primary key), `byte_size`, `page_count`, `field_count`, `created_at`. The PDF bytes are stored in R2 at `blank/<source_hash>.pdf`. They're shared across users because they're public city forms with no answers |
| `saved_permits`                   | New                 | `public_id`, `user_id`, `source_url`, `source_hash` (references `blank_pdfs`), `title`, `city_name`, `city_region`, `permit_types` jsonb, `search_id`, `notes`, `last_checked_at`, `last_used_at`, `is_outdated`. Unique on (`user_id`, `source_url`). Index on (`user_id`, `city_region`, `city_name`, `title`) for the grouped library, and on (`user_id`, `last_used_at`) for Recently used. No answers |
| `field_mappings`                  | New                 | `source_hash`, `field_name`, `fill_key` (such as `ownerPhone`), `user_id` (null for a shared mapping), `confirmed_count`; unique on (`source_hash`, `field_name`, `user_id`). Keys only, never values               |
| `projects`                        | Changed             | Add `property_from_profile`, `owner_from_profile`, `applicant_from_profile`, `contractor_from_profile` booleans. While a flag is on, that role's columns are ignored and My info is used                          |
| `project_items` → `project_forms` | Renamed and changed | Add `public_id`, `saved_permit_id` (set null on delete), `source_hash`, `status` (not started, filling, needs fixes, ready, submitted), `check_summary` jsonb, `ready_at`. The form keeps its own `source_url` and `source_hash`, so removing a permit from the library doesn't break projects that use it. Backfill a `saved_permits` row for each existing item |
| `pdf_drafts`                      | Changed             | Add `project_form_id`. Change the unique index to (`user_id`, `source_url`, `project_form_id`). Loose drafts keep a null `project_form_id`                                                                        |

The draft also records how each field got its value. Add to `DraftContent`:

```ts
// How each native field got its value, keyed like nativeValues. A field
// missing here was typed by the user.
fills: Record<string, { key: FillKey; source: 'profile' | 'project' }>
```

When the form reopens, a field whose value still matches what was filled is
refreshed from the current project and My info. A field the user changed is
dropped from `fills` and kept as typed. This makes rules 2 to 4 work without
storing a second copy of the answers.

### Code changes

- `src/lib/projects/autofill.ts`: `projectFills` takes a resolved fill
  context instead of a `Project`. It looks up `field_mappings` before guessing
  from names, and returns `{ value, key, source }` for each field. Add
  checkbox fills for questions such as "Owner is applicant" and
  "Owner-builder".
- New `src/lib/fill/context.ts`: builds the fill context from the project and
  My info using the project's `*_from_profile` flags. This is the only place
  that knows the order of the layers.
- Fields still unmatched go to Jev in one batch with nearby page text. Jev is
  the TypeSafe model `src/lib/search/typesafe.server.ts` already uses. Its
  answers are suggestions the user confirms.
- New `src/lib/checks/`: one function per check, each returning
  `{ fieldId, level, message }`. The Jev check runs on the server and the
  rest run in the browser.
- New areas `src/lib/permits/`, `src/lib/profile/`, `src/lib/fill/`,
  `src/lib/checks/` and `src/lib/dashboard/`, laid out as described in the
  API design below.
- An R2 binding for blank PDFs in `cloudflare.config.ts`, next to
  Hyperdrive. `fetchPdfBytes` gains a `storeBlankPdf` step that writes once
  per hash.
- Draft autosave also saves `check_summary`, so the project page and the
  dashboard can show status without opening the PDF.

## API design

The API keeps the pattern the app already uses. Each area has three files:

- `types.ts`: shared types and zod schemas, with messages written for people.
- `<area>.ts`: `createServerFn` exports, which are what pages call.
- `<area>.server.ts`: Drizzle queries that take `(db, userId)`.

Every account function follows the same rules as `src/lib/projects/projects.ts`:

- It runs inside `withUserDatabase`, so the browser never sends a user ID.
- Input goes through `parseUserInput(schema)`, and the first issue is thrown
  as a `UserError`.
- It addresses rows by public ID only.
- A GET returns `null` when signed out, so the page can ask the user to sign
  in. A missing or someone else's row reads as `null` too, never as an error.
- A change returns the changed resource, or the list it belongs to, so the
  page doesn't have to ask again.
- Anything that fetches a PDF or calls Tavily or Jev goes through
  `limitRequest`.

### Server functions

`GET` and `POST` are the `createServerFn` methods. "List" means the same
summary type as the area's list function.

| Area | Function | Method | Input | Returns |
| --- | --- | --- | --- | --- |
| Dashboard `src/lib/dashboard/` | `getDashboard` | GET | none | `{ needsAttention: Array<AttentionItem>, projects: Array<ProjectSummary>, recentPermits: Array<SavedPermitSummary>, profileComplete: boolean }` in one round trip |
| Search `src/lib/search/` (existing) | `startSearch`, `getSavedSearch`, `getSearchSummary` | as today | as today | as today, but each result gains `savedPermitId?` for a signed-in user. The cached `searches` row stays shared, and the saved flags are added after it's read |
| | `getSearchHistory`, `removeSearchHistory` | as today | as today | moved from `src/lib/history/` |
| My permits `src/lib/permits/` | `listSavedPermits` | GET | `{ city?, region?, types?: Array<string>, q?, sort: 'city' \| 'recent' \| 'used' \| 'title' }` | `{ permits: Array<SavedPermitSummary>, cities: Array<{ name, region, count }>, types: Array<{ name, count }> }`. The two counts feed the filters |
| | `getSavedPermit` | GET | `{ publicId }` | `{ permit: SavedPermit, mapping: FieldMapping, projects: Array<ProjectSummary> } \| null` |
| | `savePermit` | POST | `{ sourceUrl, title, city: { name, region }, searchId? }` | `SavedPermit`. Fetches the PDF, hashes it, and stores the blank copy if the hash is new. Saving a URL that's already saved returns the existing entry |
| | `updateSavedPermit` | POST | `{ publicId, title?, notes?, city? }` | `SavedPermit` |
| | `removeSavedPermit` | POST | `{ publicId }` | the list. Project forms that use it keep working |
| | `checkSavedPermit` | POST | `{ publicId }` | `{ permit: SavedPermit, changed: boolean }`. Refetches the source and compares hashes |
| Projects `src/lib/projects/` (existing) | `createAccountProject`, `updateAccountProject` | POST | `projectInputSchema` plus `fromProfile: { property, owner, applicant, contractor }` | as today |
| | `addPermitToProject` (replaces `addToAccountProject`) | POST | `{ projectId, savedPermitId }`, or `{ projectId, sourceUrl, title, searchId? }`, which saves to the library first | `ProjectForm` |
| | `removeProjectForm` (replaces `removeFromAccountProject`) | POST | `{ projectId, formId }` | the project |
| | `getProjectForm` | GET | `{ projectId, formId }` | `{ project, form, permit, draft, fillContext, mapping } \| null`, everything the editor needs in one call |
| | `setFormStatus` | POST | `{ formId, status: 'filling' \| 'ready' \| 'submitted' }` | `ProjectForm`. Refuses `ready` while the saved `check_summary` has Must fix items |
| My info `src/lib/profile/` | `getProfile` | GET | none | `Profile \| null` |
| | `updateProfile` | POST | `ProfileInput` | `{ profile, linked: { projects: number, openForms: number, readyForms: number } }`, which the toast and the "Update and recheck" notices use |
| Drafts `src/lib/drafts/` (existing) | `saveAccountDraft` | POST | the draft plus `projectFormId?` and `checkSummary?` | as today |
| | `listAccountDrafts` → `listForms` | GET | `{ status? }` | project forms and loose drafts, for `/forms` |
| Fill `src/lib/fill/` | `assignField` | POST | `{ sourceHash, fieldName, key: FillKey \| 'blank' }` | `FieldMapping` |
| | `suggestFields` | POST | `{ sourceHash, fields: Array<{ name, nearbyText }> }` | `Array<{ name, key: FillKey, confidence }>` from Jev. These are suggestions only, never saved |
| Checks `src/lib/checks/` | `runPlainLanguageChecks` | POST | `{ formId, fields: Array<{ name, label, value }> }` | `Array<CheckIssue>`, all at the Review level |

The required, format, project-match, signature and current-form checks are
plain functions in `src/lib/checks/` that run in the browser. They aren't API
calls. The browser sends only their counts, as `checkSummary` on draft save.

### Core types

```ts
interface SavedPermitSummary {
  publicId: string
  title: string
  city: { name: string; region: string }
  permitTypes: Array<string>
  pageCount: number
  projectCount: number
  lastUsedAt: string | null
  lastCheckedAt: string
  isOutdated: boolean
}

interface SavedPermit extends SavedPermitSummary {
  sourceUrl: string
  sourceHash: string
  notes: string
  search?: SearchLink
}

type FormStatus = 'not-started' | 'filling' | 'needs-fixes' | 'ready' | 'submitted'

interface ProjectForm {
  publicId: string
  title: string
  // Null when the permit was removed from the library; the form still works.
  savedPermitId: string | null
  sourceUrl: string
  sourceHash: string
  status: FormStatus
  checkSummary: { mustFix: number; review: number; checkedAt: string } | null
  updatedAt: string
}

// Keyed by the PDF's own field name. 'blank' means "leave this empty".
type FieldMapping = Record<string, FillKey | 'blank'>

interface CheckIssue {
  fieldName: string
  level: 'must-fix' | 'review'
  message: string
}
```

### HTTP routes

Two routes stay outside server functions because they aren't JSON:

- `GET /api/pdf?url=` is unchanged and proxies a city's PDF.
- `GET /api/pdf?hash=` is new and serves a stored blank PDF from R2. It's
  cached as immutable, because the hash names the bytes. The editor loads
  saved permits and project forms this way, so they keep working when a city
  moves or deletes the original link.

## Phased rollout

Each phase ships on its own and leaves the app working.

1. **Dashboard and app shell.** `/` becomes the dashboard (the landing page
   when signed out), results move to `/search/results`, and the sidebar and
   top bar arrive.
2. **My permits.** The R2 bucket, `blank_pdfs`, `saved_permits`, Save permit
   on results and in Quick fill, `/permits` with city grouping, filters and
   sort, and `/api/pdf?hash=`. `project_items` becomes `project_forms`.
3. **Drafts per project.** `project_form_id` on drafts, the
   `/projects/$id/forms/$formId` route, form statuses, and the tabbed project
   page. `/drafts` becomes `/forms`.
4. **My info.** `user_profiles`, `/me`, the setup panel, the
   `*_from_profile` flags, and the new-project steps.
5. **Fill v2.** The fill context, `fills` in drafts, `field_mappings`, the
   Fill tab, Assign, Save up, and refreshing open forms.
6. **Checks.** `src/lib/checks/`, the Check tab, Mark ready, status rollups,
   and the full Needs attention section on the dashboard.

## Implementation order

Each step is one pull request. It passes `npm run typecheck` and `npm run
lint`, and leaves every old URL working. Steps within a phase go in order.
Phases 4 and 5 can run in parallel with phase 3 once phase 2 is done.

**Phase 1: Dashboard and search split** (no schema changes)

1. Move results to `/search/results` and `/search/results/$searchId`, and
   redirect `/results*` and `/search`. Keep past searches on `/history`.
   Update every link to the old routes.
2. Make `/` a signed-in "What's next" dashboard with `getDashboard` and
   `next-steps.ts`: Continue, projects with their next step, and forms not in
   a project. Signed-out visitors get the landing page's search form.
3. Add the signed-in app shell: `AppSidebar` from the root route's layout,
   the top bar with the search box and its kept current search
   (`current-search.ts`), and `AppPage` for every page's frame. Below lg, the
   header and footer return.

Done. Every later phase adds its section to the sidebar (My permits in step
11, Forms in step 15, My info in step 16) and its next steps to
`next-steps.ts`.

**Phase 2: My permits**

4. Add the R2 binding, the `blank_pdfs` table, and `storeBlankPdf` in
   `fetch-pdf.server.ts`. Add `GET /api/pdf?hash=`.
5. Add the `saved_permits` table and the `src/lib/permits/` area with
   `savePermit`, `listSavedPermits`, `getSavedPermit`, `updateSavedPermit`
   and `removeSavedPermit`.
6. Add Save permit to search results, with `savedPermitId` on each result.
7. Build the `/permits` library: city grouping, filters, sort, and URL state.
8. Build the `/permits/$permitId` page, without the field mapping yet.
9. Rename `project_items` to `project_forms`, backfill `saved_permits`, and
   add `addPermitToProject` and the library picker on the project page.
10. Add `checkSavedPermit` and the "City posted a new version" badge.
11. Show My permits on the dashboard and add it to the header.

**Phase 3: Drafts per project**

12. Add `project_forms.public_id`, `status` and `pdf_drafts.project_form_id`,
    and change the draft unique index. Existing drafts attach to the project
    form with the same URL, if there's exactly one.
13. Add the `/projects/$id/forms/$formId` route and `getProjectForm`. The
    editor loads from the stored blank PDF.
14. Split the project page into Overview, Forms and Details tabs, with status
    badges.
15. Rename `/drafts` to `/forms` with `listForms`.

**Phase 4: My info**

16. Add the `user_profiles` table, the `src/lib/profile/` area, and the `/me`
    page.
17. Add the `*_from_profile` flags on projects and the linked role cards on
    the project Details tab.
18. Rebuild the new-project flow in the steps of workflow 3, and add the
    first-run setup panel.

**Phase 5: Fill v2**

19. Add `src/lib/fill/context.ts`, and change `projectFills` to return
    `{ value, key, source }`. Quick fill uses My info.
20. Bump `DraftContent` to version 2 with `fills`, reading version 1 as empty
    `fills`. Add the refresh-on-open rules.
21. Add the `field_mappings` table, `assignField`, and the Fill tab with
    Assign and Answer here.
22. Add Save to project and Save to my info prompts, and the
    `updateProfile` notices for linked forms.
23. Add checkbox fills and `suggestFields` with Jev.

**Phase 6: Checks**

24. Add `src/lib/checks/` with the required and format checks, the Check tab,
    and `checkSummary` on draft save.
25. Add the project-match, sign-and-date and current-form checks.
26. Add `setFormStatus` with Mark ready, the frozen-form notices, and status
    rollups on the project and dashboard.
27. Add `runPlainLanguageChecks` with Jev.

## Open questions

- Contractors work with the same few homeowners, designers and subcontractors
  again and again. Should they get a saved-contacts list later, so other
  people can be picked instead of retyped?
- Should a confirmed field mapping for a public city form be shared with every
  user, or kept per user? Sharing improves auto-fill faster, but needs a rule
  for when a mapping is trusted.
- Do we track forms after "ready": submitted, approved, inspection dates?
- Many cities use online portals instead of PDFs. Do we save portal permits as
  a link with a checklist, even though we can't fill them?
- Should projects hold attachments such as site plans and photos?
- When the city replaces a form, do we carry the draft's answers over to the
  new PDF automatically, or ask first?
