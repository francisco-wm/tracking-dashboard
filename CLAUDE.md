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

The one exception is opt-in: Fragment editing has an "Include internal users" switch (on by default). Off
(`?internal=exclude`) adds `INTERNAL_PEOPLE[env]` from its `config.ts`: cohort 61287 "Wingmaite internal
users" in production (PostHog's own test-account filter), a `@wingmaite.com` email in staging (no cohort
there). Don't add exclusions anywhere else unless asked.

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

The canonical SQL is `METRIC_SQL` in `src/lib/posthog/metrics.ts`, shared by every dashboard. Add new metrics
there instead of writing a variant inside a dashboard.

| Metric                  | Definition                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Questions asked         | `chat_message_sent` where `properties.chat_type = 'chat'` (count)                                   |
| People asking           | Unique persons with a question                                                                      |
| Contributions           | `knowledge_shared` (count; one per message in a knowledge-creation chat). Creation, not consumption |
| People contributing     | Unique persons with a contribution                                                                  |
| New knowledge listed    | `kp_status_changed` where `from_status = 'draft'` and `to_status = 'published'`                     |
| Re-listed               | `knowledge_piece_republished`                                                                       |
| First-time creators     | Persons whose first-ever new listing (all history) falls in the window                              |
| Email clicks            | `reach_email_cta_clicked` where `properties.source = 'reach_email'`                                 |
| Clickers                | Unique persons with an email click                                                                  |
| Active people           | Unique persons with a `$pageview`                                                                   |
| Edits started           | `knowledge_piece_edit_started`; fragments are keyed by `properties.knowledge_piece_uuid`            |
| Edited fragments listed | Unique fragments with a re-list                                                                     |

Weekly lifecycle, on `$pageview`, Monday weeks:

- **New**: first active week ever.
- **Returning**: active this week and last week.
- **Came back after a break**: active this week, not last week, not their first week.
- **Dropped off**: active last week, not this week. Drawn as negative.

Clicker detail, per person, from their first click after the send:

- Questions, contributions, new listings and re-lists in the 7 days before vs the 7 days after.
- Flags: asked or contributed within 24h; contributed within 7 days; listed within 7 days (a new listing or
  a re-list, in any order relative to the contribution). Don't require contribution → listing order:
  people often publish before their first `knowledge_shared` fires, and the first message of a
  knowledge-creation chat may have no `knowledge_shared` at all.
- The 7-day funnel's last step counts people who both contributed and listed, so it never exceeds the step
  before it.

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

## Fragment editing

- Period: `?range=30|90|180` (default 90) means today and the N-1 days before it. PostHog's `-90d` counts
  one more day.
- Timelines are daily, not weekly: the launch was mid-week, and a Monday bucket shows post-launch events
  under a pre-launch date.
- Edit completion (same as the PostHog funnel aggregated by `knowledge_piece_uuid`): a fragment with an edit
  started in the period is completed when a re-list of it follows within 30 days of any of its starts. Each
  fragment counts once. "Still open" = not completed and last start within 30 days, so it can still count.
- Daily completion groups by the day the edit started; a fragment edited on two days counts on both. Days
  with no started edit have no rate (`null`), not 0%.
- Every timeline marks `EDITING_PUBLIC` (23 Sep 2026), when editing opened to everyone in production. No
  production edit events exist before it; staging has internal test edits from 16 Sep.

## Building a dashboard

- One self-contained module in `src/dashboards/<slug>/` exporting a `DashboardModule`
  (`src/dashboards/types.ts`), plus one line in `src/dashboards/registry.ts`. Don't change shared code to
  add a dashboard.
- Routes are `/dashboards/<dashboard>/<section>`. Every section is linkable; ←/→ switch sections.
- Dashboard-wide filters go in the module's optional `controls(ctx, path)` (rendered next to the environment
  switch) and live in URL params, with defaults left out of the URL.
- Each section opens with one plain sentence generated from the data (keep these pure and unit-tested,
  like `sentences.ts`), then only its charts, then a collapsed "How this is measured" note.
- Charts follow the dataviz rules already in place: one y-axis, legend for 2+ series with end labels,
  hover tooltips and a table view, colours validated for colour-blind safety in light and dark.
- Unit-test date and window logic.
