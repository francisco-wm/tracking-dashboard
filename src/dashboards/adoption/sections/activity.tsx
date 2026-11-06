import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { formatDayMonth } from "@/lib/dates";

import { COLORS, weekCell, weeklyChart } from "../chart-props";
import { PER_PEOPLE } from "../config";
import { adContext, loadWeeklyEvents, loadWeeklyPeople, type EventsWeek, type PeopleWeek } from "../data";
import { perActive, share, weekIndex, type Filters, type Period } from "../filters";
import { activitySentence, plural } from "../sentences";
import { ActiveNote, WeeksNote, WhoIsCounted } from "./notes";

interface ActivityData {
  period: Period;
  filters: Filters;
  people: PeopleWeek[];
  events: EventsWeek[];
}

async function load(ctx: DashboardContext) {
  const ad = adContext(ctx);
  // Both are shared with other sections, so these reuse their cached results.
  const [people, events] = await Promise.all([loadWeeklyPeople(ctx, ad), loadWeeklyEvents(ctx, ad)]);
  return {
    data: { period: ad.period, filters: ad.filters, people: people.weeks, events: events.weeks },
    asOf: oldest(people.fetchedAt, events.fetchedAt),
  };
}

const NOBODY = "Nobody active";
const per = (value: number | null) => (value === null ? "–" : formatNumber(value, "decimal"));
const pct = (value: number | null) => (value === null ? "–" : formatNumber(value, "percent"));

function View({ data, ctx }: { data: ActivityData; ctx: DashboardContext }) {
  const { period, filters, people, events } = data;
  const last = weekIndex(period, period.lastWeek);
  const lp = people[last];
  const le = events[last];
  const week = `Week of ${formatDayMonth(period.lastWeek)}`;

  const requests: LineSeries[] = [
    {
      key: "created",
      label: "Requests created",
      color: COLORS.one,
      values: people.map((p, i) => perActive(events[i].requestsCreated, p.active)),
      emptyLabel: NOBODY,
    },
    {
      key: "answered",
      label: "Requests answered",
      color: COLORS.two,
      values: people.map((p, i) => perActive(events[i].requestsAnswered, p.active)),
      emptyLabel: NOBODY,
    },
  ];
  const shares: LineSeries[] = [
    {
      key: "asking",
      label: "Sent a chat message",
      color: COLORS.one,
      values: people.map((p) => share(p.asking, p.active)),
      emptyLabel: NOBODY,
    },
    {
      key: "contributing",
      label: "Contributed",
      color: COLORS.two,
      values: people.map((p) => share(p.contributing, p.active)),
      emptyLabel: NOBODY,
    },
    {
      key: "listing",
      label: "Listed knowledge",
      color: COLORS.three,
      values: people.map((p) => share(p.listing, p.active)),
      emptyLabel: NOBODY,
    },
  ];

  return (
    <SectionFrame
      sentence={activitySentence({
        week: period.lastWeek,
        active: lp.active,
        created: le.requestsCreated,
        answered: le.requestsAnswered,
      })}
      howMeasured={
        <>
          <p>
            <strong>Requests created</strong> counts knowledge requests sent to someone (
            <code>knowledge_request_created</code>, when the requester sends it with its first assignees).{" "}
            <strong>Requests answered</strong> counts answers published to a request (
            <code>knowledge_request_answered</code>; until the new request tracking went live on 28 Oct 2026,
            the backend sent <code>knowledge_request_completed</code> instead, so either counts). Both count
            events in the week they happened, whoever sent or answered.
          </p>
          <p>
            <strong>Per {PER_PEOPLE} active people</strong> divides a week’s requests by that week’s active
            people and multiplies by {PER_PEOPLE}: per person, the numbers are too small to read. 5.0 means
            one request for every 20 active people. If activity rises only because more people showed up,
            these lines stay flat.
          </p>
          <p>
            <strong>Shares</strong> count active people who did something at least once that week:{" "}
            <strong>sent a chat message</strong> (in a regular chat, not a knowledge-creation one),{" "}
            <strong>contributed</strong> (<code>knowledge_shared</code>, a message in a knowledge-creation
            chat) or <strong>listed knowledge</strong> (a fragment listed for the first time, or an edit
            listed). A person can do all three.
          </p>
          <ActiveNote />
          <WeeksNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="grid gap-4 lg:col-span-6 lg:grid-cols-3">
        <StatTile
          title={`Requests created per ${PER_PEOPLE} active people`}
          value={per(perActive(le.requestsCreated, lp.active))}
          caption={`${week}: ${plural(le.requestsCreated, "request")}, ${plural(lp.active, "active person", "active people")}`}
        />
        <StatTile
          title={`Requests answered per ${PER_PEOPLE} active people`}
          value={per(perActive(le.requestsAnswered, lp.active))}
          caption={`${week}: ${plural(le.requestsAnswered, "answer")}`}
        />
        <StatTile
          title="Active people who sent a chat message"
          value={pct(share(lp.asking, lp.active))}
          caption={`${week}: ${formatNumber(lp.asking)} of ${formatNumber(lp.active)}`}
        />
      </div>
      <ChartCard
        className="lg:col-span-6"
        title={`Knowledge requests per ${PER_PEOPLE} active people, weekly`}
        subtitle="Requests created and answered each week, for every 100 people active that week"
        legend={<Legend items={requests.map((s) => ({ label: s.label, color: s.color }))} />}
        table={{
          columns: [
            "Week of",
            "Active people",
            "Requests created",
            "Requests answered",
            `Created per ${PER_PEOPLE}`,
            `Answered per ${PER_PEOPLE}`,
          ],
          rows: people.map((p, i) => [
            weekCell(period, p.week),
            p.active,
            events[i].requestsCreated,
            events[i].requestsAnswered,
            per(requests[0].values[i]),
            per(requests[1].values[i]),
          ]),
        }}
      >
        <LineChart
          {...weeklyChart(
            period,
            requests,
            "Knowledge requests created and answered per 100 active people per week",
            "decimal",
          )}
        />
      </ChartCard>
      <ChartCard
        className="lg:col-span-6"
        title="What active people did, weekly"
        subtitle="Share of each week’s active people who sent a chat message, contributed or listed at least once"
        legend={<Legend items={shares.map((s) => ({ label: s.label, color: s.color }))} />}
        table={{
          columns: ["Week of", "Active people", ...shares.map((s) => s.label)],
          rows: people.map((p, i) => [
            weekCell(period, p.week),
            p.active,
            ...shares.map((s, j) => {
              const count = [p.asking, p.contributing, p.listing][j];
              return `${formatNumber(count)} (${pct(s.values[i])})`;
            }),
          ]),
        }}
      >
        <LineChart
          {...weeklyChart(
            period,
            shares,
            "Share of active people who sent a chat message, contributed or listed per week",
            "percent",
          )}
        />
      </ChartCard>
    </SectionFrame>
  );
}

export const activity: SectionModule<ActivityData> = {
  slug: "activity",
  label: "What they do",
  load,
  View,
};
