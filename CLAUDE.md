@AGENTS.md

# wingmaite analytics

Internal analytics dashboards for wingmaite (always lowercase), reading PostHog through HogQL. Setup, env
vars and the Vercel checklist are in `README.md`.

## Stack

- Next.js 16 (App Router, `'use cache'`), React 19, TypeScript, pnpm.
- Tailwind v4. UI is `@wingmaite/starling-ui` (Base UI components and tokens); shadcn (`base-nova`) only
  fills gaps starling lacks (`src/components/ui/`). Starling ships light tokens only; dark mode is remapped
  in `src/app/globals.css`.
- Charts are hand-built SVG components in `src/components/charts/`, coloured with starling tokens. No chart
  library.
- Data: PostHog Query API, EU cloud (`https://eu.posthog.com`), HogQL only, server-side only
  (`src/lib/posthog/`, `import "server-only"`).
- Auth: Auth.js v5 + Google, `wingmaite.com` Workspace only. Off in `pnpm dev`, enforced in production
  builds (`src/lib/auth/mode.ts`).
- Tests: Vitest (`pnpm test`). Also `pnpm typecheck`, `pnpm lint`, `pnpm format`.

## The key rule: everyone is counted

Never exclude internal or test users. No `filterTestAccounts`, no `$internal`/email filters, no person
cohorts that drop staff. Numbers will be equal to or higher than PostHog dashboards that filter them out,
and that is intended. Each dashboard's "How this is measured" note says so (`EveryoneCounted`).

## Other hard rules

- `POSTHOG_PERSONAL_API_KEY` stays on the server. Never send it to the browser, never commit it, never read
  or print `.env.local`.
- Only projects 60292 (Production) and 55666 (Staging) may be queried. The browser sends an env key
  (`?env=staging`), never a project ID; `src/lib/posthog/environments.ts` maps and validates it.
- All queries go through `cachedHogQL` (~10 minutes per project + query, tagged per dashboard so Refresh
  clears exactly that dashboard). Don't call `runHogQL` directly from a dashboard.
- Days and weeks are UTC. Weeks start on Monday. Dates are `ISODate` strings (`src/lib/dates`).
- Person names stay on the server unless the viewer turns on "Show names"; default labels are
  "Clicker 1", "Clicker 2", ... Production rows are customer users.
- Check every new HogQL query against both projects (PostHog MCP) before wiring it in.

## Metric definitions

The canonical SQL is `METRIC_SQL` in `src/dashboards/knowledge-champions/queries.ts`. Future dashboards use
these same definitions. When a second dashboard needs one, move `METRIC_SQL` to shared code instead of
writing a variant.

| Metric               | Definition                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Questions asked      | `chat_message_sent` where `properties.chat_type = 'chat'` (count)                                   |
| People asking        | Unique persons with a question                                                                      |
| Contributions        | `knowledge_shared` (count; one per message in a knowledge-creation chat). Creation, not consumption |
| People contributing  | Unique persons with a contribution                                                                  |
| New knowledge listed | `kp_status_changed` where `from_status = 'draft'` and `to_status = 'published'`                     |
| Re-listed            | `knowledge_piece_republished`                                                                       |
| First-time creators  | Persons whose first-ever new listing (all history) falls in the window                              |
| Email clicks         | `reach_email_cta_clicked` where `properties.source = 'reach_email'`                                 |
| Clickers             | Unique persons with an email click                                                                  |
| Active people        | Unique persons with a `$pageview`                                                                   |

Weekly lifecycle, on `$pageview`, Monday weeks:

- **New**: first active week ever.
- **Returning**: active this week and last week.
- **Came back after a break**: active this week, not last week, not their first week.
- **Dropped off**: active last week, not this week. Drawn as negative.

Clicker detail, per person, from their first click after the send:

- Questions, contributions, new listings and re-lists in the 7 days before vs the 7 days after.
- Funnel: asked or contributed within 24h; contributed within 7 days; then listed new knowledge after that
  contribution, still within 7 days of the click (same window as PostHog's funnel).

There is no "email sent" event, so the reach share uses clickers / active people since the send, not
recipients.

## Send windows (Knowledge Champions)

- `SEND_DATES` in `config.ts`; the latest send on or before today drives the page.
- After window: send day + 13 days (day 1 = send day). Before window: the 14 days just before the send.
- Before/after are matched by day index. Days that haven't happened are `null`, so the after line stops at
  today. "People" comparisons use the matched before days (`beforeMatched`) while the window is filling.
- Weekly charts: last 26 Monday weeks, a dashed marker on each send, the current week drawn lighter.
- If a metric was first tracked after the before window started, show `trackingCaveat` instead of a silent
  unfair comparison.

## Building a dashboard

- One self-contained module in `src/dashboards/<slug>/` exporting a `DashboardModule`
  (`src/dashboards/types.ts`), plus one line in `src/dashboards/registry.ts`. Don't change shared code to
  add a dashboard.
- Routes are `/dashboards/<dashboard>/<section>`. Every section is linkable; ←/→ switch sections.
- Each section opens with one plain sentence generated from the data (keep these pure and unit-tested,
  like `sentences.ts`), then only its charts, then a collapsed "How this is measured" note.
- Charts follow the dataviz rules already in place: one y-axis, legend for 2+ series with end labels,
  hover tooltips and a table view, colours validated for colour-blind safety in light and dark.
- Unit-test date and window logic.
