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

The one exception is opt-in: Fragment editing, Home widgets, Knowledge requests and Adoption have an "Include
internal users" switch (on by default). Off (`?internal=exclude`) adds `INTERNAL_PEOPLE[env]` from the module's
`config.ts`: cohort 61287 "Wingmaite internal users" in production (PostHog's own test-account filter), a
`@wingmaite.com` email in staging (no cohort there). Keep the definitions identical. Don't add exclusions
anywhere else unless asked. The Adoption dashboard (`adoption-dashboard`, code in `src/dashboards/adoption-v2/`) is the one dashboard where the switch is off by default (internal users
left out; `?internal=include` counts them), at the product team's request.

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

| Metric                  | Definition                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Chat messages sent      | `chat_message_sent` where `properties.chat_type = 'chat'` (count)                                                |
| People chatting         | Unique persons with a chat message                                                                               |
| Contributions           | `knowledge_shared` (count; one per message in a knowledge-creation chat). Creation, not consumption              |
| People contributing     | Unique persons with a contribution                                                                               |
| New knowledge listed    | `kp_status_changed` where `from_status = 'draft'` and `to_status = 'published'`                                  |
| Re-listed               | `knowledge_piece_republished`                                                                                    |
| First-time creators     | Persons whose first-ever new listing (all history) falls in the window                                           |
| Email clicks            | `reach_email_cta_clicked` where `properties.source = 'reach_email'`                                              |
| Clickers                | Unique persons with an email click                                                                               |
| Active people           | Unique persons with a `$pageview`                                                                                |
| Active in the app       | `$pageview` on `/o/<slug>/…` (`/dashboard/<slug>/…` before July 2026), not `/o/<slug>/setup`                     |
| Active organisations    | Distinct `<slug>` in the path of in-app page views (`ORG_SLUG`)                                                  |
| Edits started           | `knowledge_piece_edit_started`; fragments are keyed by `properties.knowledge_piece_uuid`                         |
| Edited fragments listed | Unique fragments with a re-list                                                                                  |
| Home-page views         | `$pageview` where `$pathname` is `/o/<slug>`, the organisation home page and the widgets' only home              |
| Widget clicks           | `dashboard_widget_clicked`, by `properties.widget_id` and `properties.action`                                    |
| Failed widget loads     | `dashboard_widget_fetch_failed`, by `properties.widget_id`                                                       |
| Widget retries          | `dashboard_widget_retry_clicked`, by `properties.widget_id`                                                      |
| Drafts created          | `knowledge_piece_created`; carries the draft's `knowledge_piece_uuid` and `chat_uuid`                            |
| Draft messages          | `chat_message_sent` where `chat_type = 'knowledge_creation'`; includes a chat's first message                    |
| Requests answered       | `knowledge_request_answered`, on the publisher; old backend sent `knowledge_request_completed`                   |
| Gaps detected           | `knowledge_gap_detected`: the AI drafted a request in a chat; nobody is assigned yet                             |
| Requests sent           | `knowledge_request_created`: the first assignment, not the AI draft; `knowledge_request_uuid`                    |
| Requests opened         | `knowledge_request_opened`, once per request, by the first person assigned who opens it                          |
| Not opened in 7 days    | `knowledge_request_ignored`: still unopened 7 days after sending; not for closed or deleted                      |
| Rejections              | `knowledge_request_rejected`, by `properties.reason` (optional) and `properties.reassigned`                      |
| Answers                 | `knowledge_request_answered`: a published reply linked to the request; several per request                       |
| Requests closed         | `knowledge_request_closed`, by `properties.outcome` (`resolved` or `cancelled`)                                  |
| AI suggestions          | `system_contribution_created`/`_approved`/`_rejected`; request id is `knowledge_request_id`                      |
| Core action             | Chat message, new fragment (draft or upload), edit, listing or re-list, `attached_source`, request sent/answered |
| Files uploaded          | `knowledge_piece_created` with `knowledge_piece_type = 'file'`: company knowledge, no chat; videos too           |
| Files attached          | `attached_source`: a file or Notion page attached in a chat, for that chat only                                  |
| Sourced answer          | Regular-chat message with a `knowledge_fragment_used_in_response` (`usage = 'cited'`) before next                |
| Registrations           | `user_created` (the person is the new user); invited when they also have `invitation_accepted`                   |
| Seats (approximate)     | People seen on an organisation's custom events, minus `left_organization`; no seat count exists                  |

Weekly lifecycle, on `$pageview`, Monday weeks:

- **New**: first active week ever.
- **Returning**: active this week and last week.
- **Came back after a break**: active this week, not last week, not their first week.
- **Dropped off**: active last week, not this week. Drawn as negative.

Clicker detail, per person, from their first click after the send:

- Chat messages, contributions, new listings and re-lists in the 7 days before vs the 7 days after.
- Flags: sent a chat message or contributed within 24h; contributed within 7 days; listed within 7 days (a
  new listing or a re-list, in any order relative to the contribution). Don't require contribution →
  listing order:
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
- The Completion tab counts edits, not fragments: every `knowledge_piece_edit_started` is one edit, so a
  fragment edited twice counts twice. Fragment ids never change, so an edit is listed when a re-list of its
  fragment follows within 30 days and before that fragment's next edit start; one re-list never completes two
  edits. PostHog's funnel counts fragments, so its rate can differ.
- "Still in draft" (the product's wording; not "still open") = not listed, the fragment's newest edit, and
  started within 30 days, so it can still count. An older unlisted edit counts as not listed.
- Tiles: Edits started and Re-listed, each captioned with its distinct fragments, then the completion rate
  and still in draft. Re-listed reuses the Edits listed tab's totals query, so it includes re-listings whose
  edit started before the period.
- Daily charts group edits by the day they started, so they add up to the tiles. Days with no started edit
  have no rate (`null`), not 0%. Above the rate, "Edits started vs listed" plots the counts behind it, so a
  100% day reads as "1 of 1". Never put counts and the rate on one chart: that needs a second y-axis.
- Every timeline marks `EDITING_PUBLIC` (23 Sep 2026), when editing opened to everyone in production. No
  production edit events exist before it; staging has internal test edits from 16 Sep.

## Home widgets

- Widgets: `recent-fragment-drafts`, `assigned-knowledge-requests`, `recent-private-files` (`WIDGETS` in
  `config.ts`, each with a fixed colour: chart-1, chart-2, chart-3). Actions: `open_item`,
  `create_fragment_draft` (drafts widget only). All three are shown to everyone on the home page.
- Period: `?range=30|90|180` (default 90). Widget tracking started on `TRACKING_STARTED` (23 Sep 2026, both
  projects): every query counts from the later of the range's first day and that date (`period.from`), home-page
  visits included, so shares compare the same days. Sentences then open "Since widget tracking started on 23
  Sep". Staging's test clicks from 14 Sep are left out. Timelines are daily, show days before it as gaps, and
  mark it.
- Clicks carry no item id, so follow-through links a click to the same person's next event within
  `LINK_SECONDS` (30 s; every match so far was within 1 s): the `knowledge_piece_created` after "Create draft",
  or the `/company-knowledge/fragments/<uuid>` page view after opening a draft. That uuid is the
  `knowledge_piece_uuid`.
- New drafts: every "Create draft" click creates one draft, so the funnel is drafts started → got at least one
  message within 7 days → also listed (new listing or re-list) within 7 days. Every step counts drafts, not
  people or messages; the total message count is shown alongside. Count messages with `chat_message_sent` in
  the draft's chat, not `knowledge_shared`, which misses first messages. The last step requires a message, so
  it never exceeds the step before it.
- Opened drafts: each draft counts once; listed when a new listing or re-list follows any of its opens within
  7 days.
- Requests are per person (widget clicks carry no request id): answered when the same person published an
  answer to any request (`knowledge_request_answered`) within 7 days of one of their clicks. Production still
  runs the old backend, which sends `knowledge_request_completed` instead, so either event counts until the
  new tracking ships there.
- Only the clicks get the internal-users filter; what follows a click belongs to that person.
- Reliability: there is no successful-load event. Failed share uses home-page views as the denominator; a
  retry worked when that person's widget didn't fail again within 60 s.

## Knowledge requests

- A request is the unit, never a person: the requester, assignees and answerers are different people. The
  base set is requests sent (`knowledge_request_created`) in the period, each followed to today by
  `knowledge_request_uuid` (`knowledge_request_id` on `system_contribution_*`). The Gaps tab counts gaps
  detected in the period instead.
- Period: `?range=30|90|180` (default 90), by the day a request was sent. Hard start: the new tracking began at
  `TRACKING_STARTED[env]`, a UTC day and hour (`config.ts`: production 28 Oct 18:00, when the release went live;
  that morning's gaps still had no request id. Staging 26 Oct 2026, midnight). Every query counts from the later
  of the range's first day and that moment (`countedFrom(period)`), and sentences then open "Since the new
  request tracking started on 28 Oct". The first day's chart label and the period note give the hour. Nothing
  earlier counts: before it, most of these events didn't exist.
- Every tile and chart counts the same requests: those sent in the counted days, with their events whenever
  they happened. Don't narrow a card to requests sent after its event started; that made tiles disagree.
- Events and properties can still appear after the start, so `TRACKED` (`config.ts`) is checked per project: a
  card shows a waiting card naming the missing event or property until it has appeared, and a note at the top
  says when something first appeared after the start. Gaps without `knowledge_request_uuid` can't be matched;
  they show as their own segment and stay out of the sent share.
- Daily charts cover the counted days only and group by the day a request was sent (Overview: sent, answered,
  resolved) or a gap detected (Gaps: detected, sent), so the days add up to the tiles. Today is drawn lighter.
- Only who sent the request (or whose chat raised the gap) gets the internal-users filter; what happens to a
  request afterwards belongs to it.
- `knowledge_request_opened` fires once per request, for the first assignee who opens it, named or through a
  team. That can be the requester, when they assigned themselves or are in an assigned team: they are an
  assignee, so it counts as an open. That is intended; don't exclude it.
- Funnel: sent → opened by an assignee → also answered → also resolved; each step requires the ones above,
  and skips are counted under it. It starts at "sent", not the gap (gaps and requests count on different
  days); the gap-to-request rate is only on the Gaps tab, not on Overview, because requests sent from drafts
  made before the tracking started have no gap to match. Steps not tracked yet are left off.
- Times are medians, counted from the first assignment: `time_since_assigned_seconds` (open), the first
  answer's `seconds_open`, and `seconds_open` on resolved closes.
- HogQL: an unmatched LEFT JOIN side reads as defaults (1970, 0), not NULL, so joined events are collected
  into arrays. `quantileExactIf` and correlated subqueries aren't supported.

## Adoption

- The baseline for the adoption question: weekly active people, who comes back after their first two weeks,
  and knowledge requests per active person, plus active organisations.
- Active means "Active in the app" (`METRIC_SQL.appActive`), not any `$pageview`: most people who only see
  `/signin`, `/login`, `/` or setup pages never sign in, and counting them doubled some weeks (Dec 2025: 372
  people with a page view, 27 in the app). The same filter gives the organisation, from the path.
- Period: `?range=13|26|52` Monday weeks (default 26), this week included and drawn lighter. Headline numbers
  use last week, the latest complete one, and compare it with 4 weeks before.
- The weekly active people chart adds a trailing 4-week average (`AVERAGE_WEEKS`, 28 days: the points are
  weeks, so 30 days isn't a whole number of them). It starts once 4 full weeks exist in the period and leaves
  out this week, whose partial count would pull it down. A switch on the chart hides it (client state in
  `active-chart.tsx`, shown by default, not in the URL).
- New = first in-app day ever (all history), grouped by its Monday week; it matches "New" in the lifecycle.
  Came back after two weeks = active again on day 15 to 28, the first day being day 1. A start week gets a
  rate only once its Sunday starter has had day 28; until then its people are "still in their first four
  weeks" and stay out of the headline rate.
- Requests per 100 active people (per person is too small to read): `knowledge_request_created` and
  answers (`knowledge_request_answered`, or `_completed` from the old backend) in the week, over that week's
  active people. Shares (sent a chat message, contributed, listed) count only active people, so they never
  exceed 100%.
- Organisation slugs are customer names: hidden behind "Show names" (`?names=1`), "Organisation 1", ... by
  default.

## Adoption dashboard (v2)

- Served at `/dashboards/adoption-dashboard`; the code stays in `src/dashboards/adoption-v2/`. The first
  Adoption dashboard (`src/dashboards/adoption/`) is hidden: not in `registry.ts`, so its URL 404s.
- Spec and source mapping: the "Adoption Dashboard v2 — Spec" Claude Doc
  (https://claude.ai/artifact/Rb6K3Rr2gB1TGnKnaY379Z). Sections: Headline, Account health, Activation,
  Retention, Knowledge loop.
- Active means a core action (`METRIC_SQL.coreAction`), not a page view. The organisation is
  `properties.organization_uuid`, on every custom event (page views don't carry it); names are customers', shown
  only with "Show names".
- Citations link to a message by chat: `conversation_id` on the citation equals `chat_uuid` on the message.
  They started at `CITATIONS_STARTED[env]` (production 28 Oct 2026 18:00, staging 19 Oct 12:46): weeks before
  are `null`, and the funnel waits until people registered after it have had 28 days (25 Nov 2026).
- Paying status and file-ingestion failures are out of v2: no source exists.
- Knowledge going in (Supply, and Account health's "New fragments") is only what answers can cite: listings, re-listed edits and files uploaded to
  company knowledge. Drafts and edits don't count until listed. Cited files are about half of all citations.
- Weekly charts mark `ANNOTATIONS` (`config.ts`) and every Knowledge Champions send (that dashboard's
  `SEND_DATES`, planned ones included), each from its day on. Close markers' labels stack (`markerRows`).
- v2 imports v1's filters, chart helpers, notes and `FilterControls` from `../adoption`; move them into v2 when
  v1 is retired.
- HogQL: an output alias equal to a column used elsewhere in the same SELECT resolves to the alias (nested
  aggregate or type errors). Give outputs their own names.

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
