# Search flow plan

Search changes from one web search for every city into two paths:

- **A city on a supported permit portal:** the city's own list of online
  permit types, matched to the project, plus the web search for PDFs and
  handouts.
- **Any other city:** the web search, as today.

The portal's permit types are cached in the database and refreshed every 24
hours, the same way saved searches are reused.

Related plans:
- [online-applications-plan.md](online-applications-plan.md): online
  applications as project items, and the provider-neutral catalog this
  search reads.
- [permit-tracking-plan.md](permit-tracking-plan.md): the providers and
  their cities.
- [twin-cities-permit-portals.md](twin-cities-permit-portals.md): the
  research behind them.

## The flow

```
search (city, project description)
  │
  ├─ providerForCity(city)
  │     │
  │     ├─ none ─────────────► web search (Tavily + Jev)          ─┐
  │     │                                                          │
  │     └─ provider, jurisdiction                                  │
  │           ├─ catalog for the jurisdiction (cached, 24 h) ─┐    │
  │           │     └─ Jev: which types does the project need? │    │
  │           │           └─ requirements for the matches     │    │
  │           │              (cached, 24 h)                   │    │
  │           └─ web search, as above, at the same time ──────┤    │
  │                                                           ▼    ▼
  └──────────────────────────────────────► one saved search response
```

1. **Find the city's provider.** The search's city goes through
   `providerForCity`, the same registry permit tracking uses. Only providers
   whose capabilities include `catalog` take part.
2. **Run both in parallel.** In a supported city, the portal match and the
   web search start together, so the portal adds no wait. Elsewhere, only the
   web search runs.
3. **Match the project to the city's permit types.** Jev gets one yes/no
   question per permit type in the jurisdiction's catalog: does the project
   need this one? Batches of 40 run in parallel. Types scoring 0.5 or more are
   kept, highest first, up to 3.
   - This is yes/no per type, not a single pick, because a project can need
     more than one permit (a deck can need building and zoning).
   - It's a different question from the web search's generic permit types
     ("building permit"). These are the city's own types ("Residential -
     Deck- replace/repair existing or new").
4. **Read the requirements for the matches** (up to 3 pages, cached).
5. **Save the response** in `searches`, as now. Reusing a saved search for 7
   days, and "Search again" at most every 24 hours, both work unchanged.

If the portal side fails (the provider is down, or the catalog can't be
read), the search still returns the web results, with no online
applications, and logs the failure. The portal is an addition, never a
reason a search fails.

## What the results look like

In a supported city, the results open with an **Apply online** section
before the web results:

```
APPLY ONLINE · ST. LOUIS PARK ePERMITS
────────────────────────────────────────────────────────────
Residential - Deck- replace/repair existing or new
Building -Residential (Plans Required)          (PLANS REQUIRED)
Upload to ProjectDox after applying: a site plan…; a drawing of the deck…
[Apply on ePermits ↗]  Requirements ↗  + Add to project
────────────────────────────────────────────────────────────
FORMS AND PAGES
…web results, as today; PDFs are the alternative to applying online…
```

- Each match shows its name, category, a "Plans required" badge when the
  category says so, and the documents the city asks for.
- **Add to project** adds it as an online application item; see
  online-applications-plan.md.
- With no matches in a supported city (the work isn't in the city's online
  list), the section says so in one line, and the web results follow.
  Crystal, for example, lists only single-family items online.

## Caching

The portal data has two layers, each refreshed when it's next used after 24
hours. That's the same pattern saved searches use, with no background job:

| Data | Table | Refreshed |
|---|---|---|
| A jurisdiction's list of permit types | `portal_permit_types`, with freshness in `portal_catalogs` | When a search in that city finds `portal_catalogs.expires_at` past. One request per city |
| One type's requirements | `portal_permit_types.requirements`, `requirements_fetched_at` | When a search matches it and it's older than 24 hours. One request per type |
| The search response, including its online applications | `searches.response`, as now | Reused for 7 days. "Search again" runs at most every 24 hours |

- **A failed refresh keeps the old data.** It records the error on
  `portal_catalogs` and tries again on the next search. A catalog that has
  never loaded yields no online applications.
- **Dropped types are kept.** A type missing from a refresh keeps its row,
  since applications in projects point at it. Its `seen_at` stops moving and
  it's no longer matched.
- **Concurrent refreshes are harmless.** Two searches in the same city may
  both refresh; the upserts are idempotent.
- **Load on the portals stays small.** At most one catalog request per city
  per day, plus a few requirement pages, which suits LOGIS's robots.txt for
  now. A scheduled refresh (a Cron Trigger) can replace the refresh-on-use
  later without changing the tables.

## Schema

The full definitions are in online-applications-plan.md. This flow needs:

- **`portal_catalogs`:** one row per (`provider`, `jurisdiction`), with
  `fetched_at`, `expires_at`, `type_count` and `last_error`.
- **`portal_permit_types`:**
  - The provider, jurisdiction and external ID (unique together).
  - `name`, `category`, `plans_required`.
  - `page_url`: required, a public page for the type, unique per type. An
    adapter without a per-type page uses the portal's page with the type's
    ID in the fragment.
  - `apply_url`, `fee_estimator_url`, `requirements`,
    `requirements_fetched_at`, `details`, `seen_at`.
- **`PermitSearchResponse`** gains `onlineApplications`, an array of matched
  types with their score. It's optional, so saved responses from before still
  render.
- `SEARCH_PIPELINE_VERSION` goes from 3 to 4, so older saved searches aren't
  reused for new ones.

## Providers page

The About page lists every provider, what it supports (finding permit types,
requirements, status checks) and its cities, all read from the provider
registry. Adding a provider updates the page.

## Build order

1. The tables, and the LOGIS adapter's `listPermitTypes` and
   `readRequirements` with the 24-hour cache.
2. Jev matching, and `onlineApplications` in the search response.
3. The Apply online section on the results page.
4. Online application items in projects.
5. The providers list on the About page.

## Open questions

- **A city on two systems:** some cities move part of their permits to a new
  system (St. Paul moved to EnerGov in 2025). For now, a city maps to one
  provider.
- **County jurisdictions:** for unincorporated areas the county issues
  permits. City-only matching is enough for the metro to start.
