# Permit determination: search design

A ground-up design for search, not tied to the current pipeline.

We should build permit determination, not document search. The user's real
question is "what do I legally need to do to build this, at this address?"
The answer is a set of requirements; documents are the evidence and the forms
to act on.

The design turns each jurisdiction's documents into structured, cited rules
ahead of time. It then reasons over those rules against a structured
description of the project. Vector search is a supporting part for unusual
projects, not the core.

The hard parts, in order:

1. Mapping an address to every government and zoning layer that covers it.
2. Turning documents into rules with a shared taxonomy.
3. Collecting documents through adapters for the few vendors most cities use.
4. A labeled test set, so design choices are measured rather than argued.

## Goals and non-goals

Goals:

- Tell the user which permits their project needs, which it doesn't, and why,
  with every claim citing the passage it came from.
- Hand them the form or online application for each permit, plus what to
  submit, the fees and who to contact.
- When the answer hinges on a detail we don't have, ask for that detail and
  nothing else.
- Work in any US city, with confidence that is shown honestly where coverage
  is thin.

Non-goals, for now:

- Commercial projects. Residential covers most of our users, and about 15
  work types cover most residential questions.
- Legal advice or plan review. We point to the city's rules; the city decides.
- HOA rules and private covenants. They aren't public and aren't government
  requirements.

## What the user gets back

For "build a 12×16 deck at 123 Main St":

```
NEEDED
  Building permit     The deck is attached and over 30 in above grade.   § 9-2.3 ↗
                      [Application PDF] [Apply online] Submit: site plan, framing plan
  Zoning review       It sits in the rear setback.                       § 36-75 ↗

NOT NEEDED
  Electrical permit   Unless you add lighting or outlets.                § 9-4.1 ↗

ONE QUESTION
  How high will the deck be above the ground?   (changes: building permit)
```

## Architecture

```
address ──► 1. Jurisdictions ──► city, county, state, districts
               (parcel lookup)   zoning district, overlays
                                        │
                                        ▼
                         ┌── 2. Collection (vendor adapters + crawler)
   offline, per          │          │
   jurisdiction          │          ▼
                         │   4. Documents → rules ◄── 3. Model code baseline
                         │          │                  (IRC + state + local)
                         └──────────┼──────────────────────────────────┐
                                    ▼                                  │
project text ──► project fields ──► 5. Answer                          │
                     ▲               candidate rules → questions →     │
                     └── answers ──  cited decision → forms, fees      │
                                                                       │
                         6. Freshness: re-collect, versions, review ◄──┘
```

Layers 2–4 run ahead of time, or on the first search in a city. Layer 5 runs
per query. Layer 6 keeps the rest current.

## 1. Jurisdictions

The right documents depend on the parcel, not the city name.

- **Every government with authority there.** City, county, state, and
  sometimes a watershed district or a historic commission. Many small cities
  hand building inspection to the county, and some states run electrical
  permits themselves.
- **The parcel's zoning district and overlays,** such as floodplain,
  shoreland or historic districts. These come from city and county map data,
  much of it published as ArcGIS services.
- **Address to parcel.** A geocoder gives coordinates; county parcel layers
  give the parcel and its ID.

Where parcel data isn't available, we fall back to the city and say that
zoning-dependent answers are less certain.

## 2. Collection

The US has about 19,000 municipalities, but their software comes from a
handful of vendors. One adapter per vendor covers many cities.

| Source | Main vendors | What it gives us |
|---|---|---|
| City code | Municode, American Legal, eCode360 | The legal rules, already split into numbered sections |
| Permit portals | Accela, Tyler EnerGov, OpenGov, Cloudpermit, CityView | The city's official permit types and how to apply |
| Websites | CivicPlus, Granicus, Revize | Handouts, forms, checklists |

For sites no adapter matches, a general crawler reads only the permits,
building, zoning and planning sections, to a fixed depth and page count.

Each collected document is stored with its URL, content hash, fetch date,
the page and heading it was linked from, and its breadcrumb path.

## 3. Model code baseline

Most jurisdictions adopt the International Residential Code (IRC) with state
and local amendments. The model code's exemptions answer many questions
everywhere. For example, IRC R105.2 exempts decks under 200 sq ft that are no
more than 30 in above grade, aren't attached to the house and don't serve an
exit door. Fences up to 7 ft are exempt too. (Exact thresholds vary by IRC
edition and must be checked against the edition each state adopted.)

So each jurisdiction's rules are layered:

```
model code (IRC edition)  →  state amendments  →  local amendments
```

That gives a reasonable answer even for a city we haven't indexed yet, marked
as lower confidence.

## 4. Documents to rules

Each document is read once, when it's collected.

1. **Parse** it, using page layout, with OCR for scanned PDFs.
2. **Classify** its role: application, checklist, handout, code section, fee
   schedule, agenda.
3. **Extract rules** in one shared format:

```
Rule {
  jurisdiction
  permit_type:   canonical type + the city's own name
  triggers:      work_type = deck AND (height_in > 30 OR attached = true)
  exemptions:    area_sqft <= 200 AND ...
  forms[], submittals[], fees
  source:        { document, section, quote }
  effective_date, last_verified
}
```

4. **Map to one shared taxonomy** of work types and permit types. One city's
   "Residential – Deck – replace/repair" and another's "Accessory Structure
   Permit" both map to the same deck/building entry. That lets what we learn
   in one city carry over to others.

### The search index

Sections are also indexed for the cases rules don't cover: unusual projects,
and documents whose rules didn't extract cleanly.

- **Chunk by structure,** not by fixed token windows. City codes are already
  numbered (§ 36-75 Accessory structures), and handouts have headings.
- **Prefix each chunk** with its document title and breadcrumb path, so a
  chunk reading "not required when under 200 sq ft" still says what it's about.
- **Hybrid search:** full-text plus vectors. Permit text depends on exact
  terms ("30 inches", "R-3", "setback") that full-text catches and embeddings
  blur.
- **Store whole documents too.** Most handouts are 2–10 pages and fit whole in
  one model request, which is more accurate than chunks: exemptions often sit
  in a different section from the rule.

Postgres with full-text search and pgvector is enough. A separate vector
database doesn't buy anything at this scale.

## 5. Answering a query

1. **Turn the project into fields:** work types, structure, dimensions,
   residential or commercial, where on the parcel, and whether it's new,
   a replacement or a repair.
2. **Pull candidate rules** for the address's jurisdictions and the project's
   work types. Use the hybrid search as a backup for projects the taxonomy
   doesn't cover.
3. **Ask only the questions that change the answer.** If the candidate rules
   hinge on height and attachment, ask about those. Ask first the question
   that settles the most rules. Answers are saved on the project.
4. **Decide each permit:** a model reads the rules, their full source
   sections and the project fields, and returns required, not required, or
   depends on a named field. It must quote its source. We check each quote
   exists in the document before showing it, and drop claims whose quote
   doesn't.
5. **Assemble the answer:** permits, then their forms and portal links, then
   submittals, fees and contacts.

## 6. Freshness and trust

- **Re-collect on a schedule,** busiest cities most often. Compare content
  hashes so only changed documents are re-read. Keep versions.
- **Show when each claim was last checked.**
- **Rank sources:** the city's own code beats a city handout, which beats a
  model-code default. The answer shows which one it rests on.
- **Corrections:** user reports and a review queue for high-traffic cities.
  What users add to projects and fill in is a ranking signal across cities.

## Evaluation

Build the test set before building the system, so each layer's value is
measured.

- **The set:** about 30 cities × 20 common residential projects (deck, fence,
  water heater, roof, shed, basement finish, …), each hand-labeled with the
  permits needed, the right forms and the governing passages. Cities should
  span sizes, states and vendors, and include some with county-run inspection.
- **Metrics:**
  - Permit decisions: share of required, not required and depends answers
    that match the labels.
  - Forms: whether the right forms appear in the top 5.
  - Citations: whether each cited passage actually supports its claim.
  - Questions: how many questions it took to reach a settled answer.

## Priorities and rollout

1. **Test set.** Labels for the first cities.
2. **Rule format and taxonomy** for the ~15 residential work types.
3. **Model code baseline,** so every city gets a lower-confidence answer
   from day one.
4. **Collection and rule extraction** for the busiest cities, starting with
   our current users' cities and the most common code and portal vendors.
5. **Jurisdiction layer:** parcel, zoning district and overlays.
6. **Long-tail cities** built on their first search, falling back to
   model-code defaults and a live web search while the city is indexed.

## Risks and open questions

- **Extraction accuracy.** Rules pulled wrong give confident wrong answers.
  Quote checks and the test set catch some of this; how much human review do
  we need per city?
- **Parcel and zoning data coverage** varies by county. What share of our
  users' addresses can we resolve?
- **Code publishers' terms of use.** Can we store and index their text, or
  only link to it?
- **Bot blocking.** Many city sites turn away automated requests.
- **Liability.** How do we word "not needed" so users still confirm with the
  city?
- **Cost per city** to collect and extract, which decides how far ahead of
  demand we can index.
