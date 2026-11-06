# Austin permits

How Permit Search reads Austin, Texas: provider
`austin-development-services`, in `src/lib/portals/austin*.ts`.

Researched November 5, 2026.

## Where the data comes from

| Need | Source | Notes |
|---|---|---|
| Permit types | [Types of Permits page](https://www.austintexas.gov/development-services/types-permits) | Public, allowed by the site's robots.txt. Lists each permit and how to apply |
| Requirements | The same page | Only the permit's description, so requirements are notes and links, with no document list |
| Status of issued permits | [Issued Construction Permits](https://data.austintexas.gov/resource/3syk-w9eu.json) open dataset | Official API, updated daily |
| Status of plan review cases (numbers ending in `PR`) | [Plan Review Cases](https://data.austintexas.gov/resource/n8ck-xkda.json) open dataset | Official API, updated daily. Listed from filing, with statuses such as In Review |

We request only permit columns: both datasets also hold people's names and
phone numbers.

## Why not the AB+C portal

Austin Build + Connect (AB+C, `abc.austintexas.gov`) is where many permits are
filed, but Permit Search only links to it:

- Its list of permit types shows only after signing in.
- Automated requests get an Imperva Incapsula bot challenge. We don't try to
  get past it.

## Two ways to apply

A permit's `applyUrl` is whatever the city's page links to, which is either
AB+C or a city web form. Fence, pool and deck, and interior remodel permits
are web forms, for example. So the provider is named "Development Services",
not AB+C. Permits filed by email or in person aren't offered as online
applications.

## PDF forms

The city's [Forms and Applications page](https://www.austintexas.gov/development-services/forms-applications)
lists about 350 forms, and is read on every Austin search through its
jurisdiction's `formsPage`. Links are filtered by the search's keywords, as on
any official page.

Most files are on `austin.widen.net`, whose links open a viewer page rather than
the file. Nothing is specific to that host. These results go through the same
link check as every city's, in `src/lib/search/verify-links.server.ts`:

- A link is only labeled a PDF after its first bytes are seen to be one.
- A web page that looks like a viewer of one PDF has its file found from the page
  (`src/lib/pdf/viewer-page.ts`). If the file's bytes check out, the result links
  to the file. A page that only links to PDFs stays a page.
- A 404, a 410, or a site that can't be reached drops the link. So does a `.pdf`
  address that opens a web page with no file in it.
- A site that blocks the check, errors or times out keeps the link, without the
  PDF label.

## Pre-filling web forms: tried and removed

Jotform can fill a form's fields from its URL, using each field's unique name
(`enterProject`, not `q222_enterProject`). A test on the fence form read the
values back from its live fields, but we didn't keep it:

- The form opens on a "Click to begin" screen and shows one question at a time,
  so the filled fields don't appear until about step 8 of 10.
- It only saved a few typed fields. Most of the form's work is its file uploads,
  which can't be pre-filled.
- Each of the 18 web forms would need its own field names, which could change
  whenever the city edits a form.
- The user's details reach Jotform as soon as the link opens, before they
  decide to submit.

## Limits

- **Only plan review cases have a status before issue.** Other permits, such
  as trade permits, aren't listed until they're issued, so until then a check
  says the permit isn't listed.
- **A plan review is not the permit.** An approved `PR` case shows as Approved,
  but the building permit it leads to has its own number.
- **Only some permit types.** Tree and sign permits have their own datasets
  (`ac2h-ha3r`, `8wgz-z8nv`), which we don't read yet.
- **No fees, inspections or review comments.** A status such as "Awaiting
  Update - Fees Due" is all the datasets say about fees.
- **"View permit" opens the public search until a check finds the permit.**
  Each dataset row has the permit's own link, which is kept with its status.
- **Contractor requirements aren't shown in search results.** Many trade
  permits are for registered contractors only. That's in the requirements'
  notes, which the results card doesn't display.

## Watch for

The city is seeking a contractor to replace its permit system with the Clariti
Enterprise Permitting Platform, per a procurement listing with a February 2026
due date. The award and go-live date weren't found. AB+C links, and possibly
the permit number format and the dataset, may change when that happens.
