# AI visibility plan

How to make Permit Search something AI assistants can read, cite and recommend,
such as ChatGPT, Claude, Perplexity and Google's AI Overviews.

Status: proposed, 2026-11-06. Nothing here is built yet.

Related plans:
- [search-flow-plan.md](search-flow-plan.md): how a search finds its results.
- [online-applications-plan.md](online-applications-plan.md): the supported
  permit portals.

## Goal

Two kinds of question should lead to us:

1. **A specific project:** "Do I need a permit for a fence in Edina?" We want
   to be a cited source, and to send people to the city's own form.
2. **A tool recommendation:** "How do I find the right permit forms for my
   city?" We want to be named as a tool to use.

The first is the larger opportunity and the one we can most influence, so most
of this plan is about it.

We can't control what an assistant says. We control whether it can read our
pages, whether they answer the question, and whether they can be trusted.
Search-style SEO still applies: AI Overviews draw on Google's index, and
assistants' search features run on their own indexes.

## Where we are

Checked against the running app on 2026-11-06, requesting pages as `GPTBot`.

| Area | Today |
|---|---|
| Server rendering | Works. Search pages and the homepage send their text in the HTML |
| Crawler access | `robots.txt` allows AI crawlers; account pages and `/editor` are blocked |
| Discovery | Generated `/sitemap.xml`, limited to pages passing `isIndexableSearch` |
| Page identity | Readable URLs, and a title, description and canonical URL on each search |
| Structured data | None |
| Direct answer on a search page | None. The page is mostly a list of links |
| "Last checked" date | None. A page only says "New results" or "Saved results" |
| City contacts | Not in the server's HTML: the card loads them in the browser |
| Internal links | None between searches, so crawlers rely on the sitemap |
| About the publisher | No stated owner, pricing or data sources. Contact is still `contact@example.com` |

## What to add

### 1. Answers on search pages

This is the main work. A page should answer the question before listing links.
Most of the data already exists in `searches.response` and the contacts tables,
but isn't presented as an answer.

Each eligible page gets, in this order, all in the server's HTML:

1. **Short answer:** one or two sentences on what the city publishes for this
   project, linked to the source.
2. **Permits this usually involves:** from `permitTypes`, worded as likely, not
   certain.
3. **Where to apply:** the city's portal or form, or the state agency where a
   source shows the state runs it.
4. **Who to contact:** the city office, from data we've already stored. Reading
   stored contacts on the server must not trigger a new, paid contact lookup.
5. **Sources and date:** each official link, and when we last checked them.
6. **The existing results list and disclaimer.**

Accuracy rules, since people act on this:

- Every claim comes from a stored official source, and links to it. No source,
  no claim.
- Never state "you don't need a permit" on our own authority. Requirements turn
  on details we don't have. Report what the source says and who to confirm with.
- Say so when evidence is thin: "We couldn't find a page specific to this
  project" is a good answer.
- State pages keep their label, since some cities run those permits themselves.
- An answer is shown only if Jev is confident it's supported by its source.
- Review the first batch by hand, and sample later ones, before relying on the
  automated check.

Answers should be stored per slug with their sources and check date, and
regenerated when the search re-runs, since a slug's results change over time.
They're only generated for pages passing the index filter, which limits cost.

### 2. Coverage of common searches

The filter only lists searches requested at least twice, so there will be few
pages at launch.

- Seed a curated list: the cities on supported portals, crossed with common
  projects such as fence, deck, roof, water heater, shed and basement finish.
- Let curated searches pass the filter once they have an answer that meets the
  rules above. They'd otherwise never qualify on request count.
- Start with about 50 pages, and review them before adding more. Large numbers of
  thin generated pages can hurt the whole site in search.

### 3. Links between pages

- A city page at `/results/<city>` listing its indexable searches, its portal
  and its contacts.
- Links from each search page to its city page and related searches in that city.
- Links from the homepage's supported cities to those city pages.

### 4. Facts about the product

These answer the tool-recommendation question. An assistant can only repeat what
it can find, so **all of it needs real answers from us**; see Open decisions.

- On `/about` and the homepage: who runs Permit Search, what it costs, what it
  covers, where its data comes from, how often it's checked, and how to reach us.
- A plain comparison with the alternatives: the city's website, or a permit
  expediter.
- What it doesn't do: it isn't an official source and doesn't submit applications.

### 5. Structured data

JSON-LD describing what's already visible on the page. It helps machines read a
page but won't fix a thin one, so it follows the content.

- Homepage and `/about`: `Organization`, `WebSite` and `WebApplication`.
- Search and city pages: `WebPage`, with `dateModified` and `BreadcrumbList`.
- Only mark up what a visitor can see.

### 6. Crawler settings

- Name AI search crawlers in `robots.txt` (`OAI-SearchBot`, `Claude-SearchBot`,
  `PerplexityBot`), so allowing them is a deliberate choice.
- Check Cloudflare's AI crawler settings, which can block at the network level
  whatever `robots.txt` says.
- Submit the sitemap to Google Search Console and Bing Webmaster Tools.

## What we won't do

- **Different content for AI crawlers.** Everyone gets the same page.
- **Hidden text or instructions aimed at AI.**
- **Answers without a source, or invented reviews and statistics.**
- **`llms.txt`, for now.** We found no good evidence major assistants use it. It's
  cheap to add later if that changes.
- **Indexing one-off searches.** They can hold addresses and other personal
  details, so the filter stays.

## Phases

| Phase | Work | Done when |
|---|---|---|
| 0. Launch basics | Migration 0019 and deploy; real contact address; confirm the main domain; check Cloudflare; Search Console and Bing | The sitemap is accepted, and live pages load for AI crawlers |
| 1. Baseline | Prompt set and tracking (see Measuring) | First results are recorded, before any changes below |
| 2. Product facts | Section 4, plus `Organization` and `WebSite` data | `/about` answers who, what, cost, coverage and sources |
| 3. Answer pilot | Sections 1 and 5 on 10 reviewed pages | Every claim on all 10 traces to its source |
| 4. Coverage | About 50 curated pages, city pages and links | Pages are indexed, with no accuracy problems in a sample |
| 5. Review | Compare with the baseline | Decide whether to expand, based on what moved |

Phase 3 is the real test. If reviewed answers aren't reliably accurate, stop and
fix that rather than moving on to phase 4.

## Measuring

Results take time and vary between runs, so look for trends rather than single
answers.

- **Prompt set:** about 30 fixed questions, mixing specific projects and tool
  recommendations, in cities we cover and don't. Run them monthly in ChatGPT,
  Claude, Perplexity and Google, recording whether we're named or cited, and
  whether what's said is correct.
- **Crawler visits:** AI crawlers by page, from Cloudflare's logs or AI tools.
- **Referrals:** visits from `chatgpt.com`, `claude.ai`, `perplexity.ai` and
  similar. We don't have analytics for this yet, so it needs choosing.
- **Search Console:** indexed pages, and impressions for permit searches.
- **Accuracy:** corrections and "report results" submissions on answer pages.

The most important measure is correctness. Being cited for something wrong is
worse than not being cited.

## Risks

| Risk | What we do about it |
|---|---|
| Wrong permit guidance gets repeated by an assistant | Accuracy rules, source links, dates and disclaimers; review before scaling |
| Answers go stale when a city changes its rules | Show the check date; re-check on a schedule; hide answers past a set age |
| Assistants cite the city directly and skip us | Accept it where we add little. Our value is the combined path: permits, forms, contacts and filling them out |
| Generated pages count as low quality | Small reviewed batches; only pages with a sourced answer are listed |
| Personal details in typed searches | Keep the filter; curated pages use our own wording |
| Crawlers run up costs | A search only starts from a click, never a URL, and pages read only stored data |

## Open decisions

1. **Who publishes Permit Search, and what does it cost?** Needed for phase 2.
   We shouldn't publish these until they're true and settled.
2. **Who reviews answers?** Phase 3 needs a person to check them against the
   sources, and ideally someone who knows permitting.
3. **Allow AI training crawlers?** We lean yes, as a new site benefits from being
   known. Search crawlers should be allowed either way.
4. **Which cities first?** We suggest the supported portal cities, where our data
   is best.
5. **Which analytics tool** for referrals?

## Sources

Mostly secondary write-ups. Check the vendors' own documentation before relying
on specifics, as this area changes quickly.

- Crawler roles: [Anagram](https://www.anagram.ai/blog/ai-crawlers-explained-gptbot-claudebot-perplexitybot-and-how-to-let-them-in-2026),
  [Otterly](https://help.otterly.ai/ai-crawlers)
- Google's guidance on AI features:
  [Trusted Shops](https://ai-trust-audit.trustedshops.com/en/blog/ai-overviews-and-ai-mode-google-s-requirements-for-websites-2026),
  [Digital Thrive](https://www.digitalthriveai.com/en-ca/resources/seo/google-says-normal-seo-works-for-ranking-in-ai-overviews-and-llms-txt-wont-be-used/)
- Cloudflare defaults and `llms.txt`:
  [Moburst](https://www.moburst.com/blog/digital-marketing-digest-august/),
  [HasData](https://hasdata.com/blog/ai-crawler-block-index)
