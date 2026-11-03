# Permit Search

A city-first permit search experience for homeowners and builders. Users select
a U.S. city, describe their project in plain language, and will eventually
receive permit requirements from official municipal sources.

## Current scope

- U.S. city autocomplete from a bundled Census place list, searched in the
  browser
- Browser location lookup with city-level reverse geocoding through the Census
  geocoder
- Manual city entry
- Live permit-source search through Tavily
- Cloudflare Workers configuration using the new `cf` CLI
- PlanetScale Postgres through Hyperdrive for saved searches, city contacts,
  accounts, drafts, and projects

City-site mapping and permit-link classification are future work.

## Technology

- TanStack Start with React and TypeScript
- TanStack Router file-based routing
- Tailwind CSS 4
- Cloudflare Workers and the Cloudflare Vite plugin
- Cloudflare's beta `cf` CLI with `cloudflare.config.ts`
- U.S. Census Bureau place data and geocoder
- Tavily Search API
- PlanetScale Postgres through Cloudflare Hyperdrive, with Drizzle ORM

Node.js 22.18 or newer is required by `cloudflare.config.ts`.

## Design direction

The visual style is **editorial modernism**: Swiss/International-style layout,
neo-grotesk typography, and an industrial design sensibility. The direction is
inspired by [American Housing](https://www.americanhousing.com/) without using
its branding, proprietary fonts, imagery, or other assets.

### Visual principles

- Put one task at the center of each screen.
- Use oversized, tightly tracked sans-serif headlines.
- Prefer warm neutral space over decorative containers.
- Use thin charcoal rules to create structure.
- Keep corners nearly square (`2px`); reserve pills for primary actions and
  small utility controls.
- Use generous spacing and a strict underlying grid.
- Avoid shadows, gradients, glass effects, and ornamental icon repetition.
- Keep labels short, direct, and sentence case.

### Core palette

- Cumulus: `#fdfff1` — page and form background
- Driveway: `#302d2d` — primary text, borders, and dark surfaces
- Civic blue: `#1968b4` — actions, focus states, and active selections
- Civic blue dark: `#145390` — hover state
- Brick red: `#953012` — errors and destructive emphasis

### Typography

Use the system neo-grotesk stack defined in `src/styles.css`: Arial, Helvetica,
and platform sans-serif fallbacks. Use medium weights for display and body
copy. Do not add proprietary reference-site fonts.

### Interaction conventions

- Inputs use transparent backgrounds, charcoal 1px borders, and `2px` corners.
- Keyboard focus uses a visible civic-blue ring.
- The city combobox shows city name once, with region and country beneath it.
- “Detect my city” uses device coordinates only to resolve the municipality;
  exact device coordinates are not retained.
- Loading and error states remain inline and preserve manual entry.
- Motion should be subtle and respect reduced-motion preferences.

## Repository structure

- `src/routes/index.tsx` — signed-in dashboard, or the search landing page
  when signed out
- `src/routes/history.tsx` — past searches
- `src/routes/search.results.*.tsx` — running and showing a search
- `src/components/CityCombobox.tsx` — accessible city autocomplete
- `src/lib/location/places.ts` — in-browser city search over the place list
- `src/lib/location/census.server.ts` — server-only Census reverse geocoding
- `src/lib/location/types.ts` — normalized city and coordinate types
- `src/lib/search/permit-search.ts` — validated TanStack server function
- `src/lib/search/tavily.server.ts` — server-only Tavily search provider
- `src/lib/search/official-links.server.ts` — official-page link extraction
- `src/lib/search/types.ts` — normalized permit search contracts
- `src/styles.css` — global design tokens and shared input styles
- `src/routes/__root.tsx` — document shell and page metadata
- `cloudflare.config.ts` — Worker, placement, observability, and optional Hyperdrive binding
- `vite.config.ts` — TanStack, Tailwind, React, and Cloudflare build integration

Keep third-party location logic behind `src/lib/location` so providers can be
replaced without rewriting the form. Rebuild the place list with
`scripts/build-us-places.mjs`.

## Local setup

```sh
npm install
cp .env.example .env
```

Start development:

```sh
npm run dev
```

## Quality checks

```sh
npm run typecheck
npm run lint        # oxlint (npm run lint:fix applies its fixes)
npm run build
npx cf deploy --dry-run
```

The dry run validates Cloudflare Build Output without uploading or changing
account resources.

## Deployment

```sh
npx cf auth login
npm run deploy
```

Pushes to `main` deploy automatically through Cloudflare Workers Builds,
connected to this repo in the Cloudflare dashboard (Workers & Pages →
permit-search → Settings → Builds):

- Build command: none (`cf deploy` builds the project itself)
- Deploy command: `npm run deploy`
- Non-production branch builds: off, or `npx cf deploy --dry-run` (the
  default `wrangler versions upload` doesn't work without Wrangler config)
- Build variable `CLOUDFLARE_HYPERDRIVE_ID`: required. `cloudflare.config.ts`
  only adds the `DATABASE` binding when it's set, so a build without it
  deploys a Worker with no database.
- Node comes from `.node-version`.

`cf` signs in with the `CLOUDFLARE_API_TOKEN` that Workers Builds provides.
Builds don't run database migrations: run `npm run db:migrate` before pushing
code that needs them.

This project uses `cloudflare.config.ts`, not Wrangler configuration. Keep the
beta `cf` CLI pinned through the lockfile and review changes when upgrading it.
Logs and traces are enabled in the Worker configuration.

## PlanetScale and Hyperdrive

The database is PlanetScale Postgres (branch `main`, AWS us-east-2). The
Worker reaches it through a `DATABASE` Hyperdrive binding, which
`cloudflare.config.ts` adds only when `CLOUDFLARE_HYPERDRIVE_ID` is set; without
it, database features are skipped and the rest of the site still runs.

How it's set up, and why:

- **Managed integration.** The Hyperdrive config uses Cloudflare's PlanetScale
  integration with the `postgres` scheme, connecting directly on port 5432.
  Hyperdrive pools connections itself, so it doesn't go through PlanetScale's
  PgBouncer port.
- **Query caching is off.** Nearly every read is a signed-in user's own data
  (drafts, projects, history, their session), and Hyperdrive's cache would
  serve the copy from before their last change for up to a minute. If public
  reads ever need caching, add a second, cached Hyperdrive binding for them.
- **The Worker runs next to the database.** `placement` pins it to
  `aws:us-east-2`, since a request makes several database round trips in a
  row. Static assets still serve from the edge.
- **One client per request.** `withDatabase` opens a `pg` client and closes it
  after the response; Hyperdrive keeps the pooled connections warm.
- **Separate roles.** The `migrator` role owns the schema and is used only by
  `npm run db:migrate` (`MIGRATION_DATABASE_URL`). The Worker's Hyperdrive role
  and the local development role can read and write data but not change
  tables.

To recreate the Hyperdrive config:

1. Link the Cloudflare account to PlanetScale from the Hyperdrive dashboard.
2. Preview creation:

   ```sh
   npx cf hyperdrive create \
     --name permit-search \
     --integration-provider planetscale \
     --integration-organization-name YOUR_ORG \
     --integration-database-name YOUR_DATABASE \
     --integration-database-branch-name main \
     --integration-scheme postgres \
     --dry-run
   ```

3. Remove `--dry-run` after reviewing the request.
4. Turn off query caching, which is on by default:

   ```sh
   npx cf hyperdrive update YOUR_HYPERDRIVE_ID --caching-disabled true
   ```

5. Set `CLOUDFLARE_HYPERDRIVE_ID` to the returned configuration ID, locally and
   as a Workers Builds variable.
6. Run `npm run cf-typegen` after enabling or changing the binding.

For local development, Hyperdrive connects straight to `DATABASE_URL`, with no
pooling. Use a role with the same access as production's, so permission
problems show up locally:

```sh
pscale role create YOUR_DATABASE main local-dev \
  --inherited-roles pg_read_all_data,pg_write_all_data
```

Then set `DATABASE_URL` to that role's connection string, ending in
`?sslmode=verify-full`.

Credentials must never be committed or sent to browser code.

## Tavily

Permit searches run through a TanStack server function, so the browser never
calls Tavily directly. The Worker reads `TAVILY_API_KEY` from a secret binding.
Queries use basic depth and return at most ten verified results. Results must
contain the exact city and selected state; matching city-government pages rank
ahead of other sources.

After discovery, the Worker fetches a bounded set of likely government permit
pages and streams their anchors through Cloudflare `HTMLRewriter`. Matching
official PDFs rank above general pages, with application and form PDFs ranked
above handouts and guides. Extraction failures preserve the original Tavily
results.

When city discovery is persisted, use this staged flow:

1. Search for the city's official government domain.
2. Verify the domain before trusting or saving it.
3. Extract and rank permit links from verified official pages.
4. Classify and save approved URLs in PlanetScale.
5. Serve fresh saved links from the database; queue an explicit refresh when
   city information is stale.

Store the key as `TAVILY_API_KEY` in local `.env` and as a Cloudflare Worker
secret in production; never use a `VITE_*` name for it.
