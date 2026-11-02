# Permit Search

A city-first permit search experience for homeowners and builders. Users select
a U.S. city, describe their project in plain language, and will eventually
receive permit requirements from official municipal sources.

## Current scope

- U.S. city autocomplete through Mapbox Search Box
- Browser location lookup with city-level reverse geocoding
- Manual city entry when Mapbox is unavailable
- Live permit-source search through Tavily
- Cloudflare Workers configuration using the new `cf` CLI
- An optional, non-breaking Hyperdrive path for PlanetScale

City-site mapping, permit-link classification, and database persistence are
future work.

## Technology

- TanStack Start with React and TypeScript
- TanStack Router file-based routing
- Tailwind CSS 4
- Cloudflare Workers and the Cloudflare Vite plugin
- Cloudflare's beta `cf` CLI with `cloudflare.config.ts`
- Mapbox Search Box API
- Tavily Search API
- PlanetScale MySQL through Hyperdrive when database work begins

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

- `src/routes/index.tsx` — search page, geolocation flow, and result shell
- `src/components/CityCombobox.tsx` — accessible city autocomplete
- `src/lib/location/mapbox.ts` — Mapbox provider adapter
- `src/lib/location/types.ts` — normalized city and coordinate types
- `src/lib/search/permit-search.ts` — validated TanStack server function
- `src/lib/search/tavily.server.ts` — server-only Tavily search provider
- `src/lib/search/official-links.server.ts` — official-page link extraction
- `src/lib/search/types.ts` — normalized permit search contracts
- `src/styles.css` — global design tokens and shared input styles
- `src/routes/__root.tsx` — document shell and page metadata
- `cloudflare.config.ts` — Worker, observability, and optional Hyperdrive binding
- `vite.config.ts` — TanStack, Tailwind, React, and Cloudflare build integration

Keep third-party location logic behind `src/lib/location` so Mapbox can be
replaced without rewriting the form.

## Local setup

```sh
npm install
cp .env.example .env
```

Add a complete Mapbox public token:

```dotenv
VITE_MAPBOX_ACCESS_TOKEN=pk.your_complete_public_token
```

The token is intentionally available to the browser. Restrict custom tokens to
`http://localhost:3000/*` and the production domain in Mapbox. Never place a
secret `sk.` token in a `VITE_*` variable.

Start development:

```sh
npm run dev
```

## Quality checks

```sh
npm run typecheck
npm run lint        # oxlint, then eslint
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

Database access is intentionally unused today. The Worker enables a `DATABASE`
Hyperdrive binding only when `CLOUDFLARE_HYPERDRIVE_ID` is present, so frontend
development does not require a database.

For Cloudflare's managed PlanetScale integration:

1. Link the Cloudflare account to PlanetScale from the Hyperdrive dashboard.
2. Preview creation:

   ```sh
   npx cf hyperdrive create \
     --name permit-search-db \
     --integration-provider planetscale \
     --integration-organization-name YOUR_ORG \
     --integration-database-name YOUR_DATABASE \
     --integration-database-branch-name main \
     --integration-scheme mysql \
     --dry-run
   ```

3. Remove `--dry-run` after reviewing the request.
4. Set `CLOUDFLARE_HYPERDRIVE_ID` to the returned configuration ID.
5. Set `DATABASE_URL` to the PlanetScale MySQL connection string for direct
   local development only.
6. Run `npm run cf-typegen` after enabling or changing the binding.

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
