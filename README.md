# wingmaite analytics

Internal analytics dashboards for wingmaite, built on the PostHog Query API (HogQL).
Dashboards: **Knowledge Champions email** (`/dashboards/knowledge-champions/reach`) and **Fragment editing**
(`/dashboards/fragment-editing/edits-listed`).

## Setup

1. `pnpm install` (needs the `@wingmaite` GitHub Packages token in `~/.npmrc` for `@wingmaite/starling-ui`).
2. Copy `.env.example` to `.env.local` and fill in:
   - `POSTHOG_PERSONAL_API_KEY`: EU cloud personal API key, scope `query:read`, access to projects 60292 and 55666.
   - `AUTH_SECRET`: `npx auth secret` (or `openssl rand -base64 33`).
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: a Google OAuth client with the **Internal** consent screen in the
     wingmaite Workspace, redirect URI `http://localhost:3000/api/auth/callback/google`.
3. `pnpm dev` and open http://localhost:3000.

Sign-in is **off in `pnpm dev`** for now and **always on in production builds** (`pnpm build && pnpm start`,
Vercel), where only verified Google Workspace accounts on `wingmaite.com` get in (`src/lib/auth/`). A
production build without the auth variables fails closed.

## Commands

| Task           | Command                    |
| -------------- | -------------------------- |
| Dev server     | `pnpm dev`                 |
| Unit tests     | `pnpm test`                |
| Type check     | `pnpm typecheck`           |
| Lint           | `pnpm lint`                |
| Format         | `pnpm format`              |
| Production run | `pnpm build && pnpm start` |

## How it fits together

- `src/lib/posthog/`: the server-only query client. `environments.ts` is the allowlist (Production 60292,
  Staging 55666); the browser only ever sends `?env=staging`. `cached-query.ts` caches each project + query
  for ~10 minutes (`'use cache'`); the Refresh button expires that dashboard's tag. `metrics.ts` holds the
  canonical HogQL for every metric. No test-account filters are applied: everyone is counted, unless a viewer
  turns off "Include internal users" on Fragment editing.
- `src/components/shell/`: the generic layout (title, environment switch, section tabs, ←/→ navigation,
  "data as of" + Refresh, "How this is measured").
- `src/components/charts/`: hand-built SVG charts (line with end labels and send markers, bars, lifecycle
  stack) with hover tooltips and a table view. Colours are starling-ui tokens, checked for colour-blind safety.
- `src/dashboards/<slug>/`: one self-contained module per dashboard: config, HogQL queries, data loaders,
  sentences and sections. Routes are `/dashboards/<dashboard>/<section>`.

### Adding a dashboard

1. Create `src/dashboards/<slug>/` with an `index.ts` exporting a `DashboardModule` (see `src/dashboards/types.ts`).
   Each section is `{ slug, label, load(ctx), View }`; `load` returns `{ data, asOf }`.
2. Run your HogQL through `cachedHogQL(ctx.projectId, ctx.dashboard, name, sql, values)`.
3. Add one line to `src/dashboards/registry.ts`.

Dashboard-wide filters (like Fragment editing's time range) go in the module's optional `controls(ctx, path)`;
they live in URL params, so every view stays linkable.

### Knowledge Champions: new send

Add the date to `SEND_DATES` in `src/dashboards/knowledge-champions/config.ts`. The latest send on or before
today drives the page; windows, markers and copy follow automatically.

## Moving to Vercel

- Set `NPM_TOKEN` (GitHub PAT with `read:packages`) and add `//npm.pkg.github.com/:_authToken=${NPM_TOKEN}` to `.npmrc`.
- Add the production redirect URI to the Google OAuth client.
- Switch `'use cache'` to `'use cache: remote'` in `src/lib/posthog/cached-query.ts` so instances share the cache.
