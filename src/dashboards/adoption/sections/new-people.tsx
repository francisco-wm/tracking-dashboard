import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { formatDayMonth } from "@/lib/dates";

import { COLORS, weekCell, weeklyChart, weeklyTable } from "../chart-props";
import { RETURN_FROM_DAY, RETURN_TO_DAY } from "../config";
import { adContext, loadNewPeople } from "../data";
import { share, type Filters, type Period } from "../filters";
import { returnRate, returnWindowClosed, summariseReturns, type StartWeek } from "../returns";
import { plural, returnSentence } from "../sentences";
import { ActiveNote, WeeksNote, WhoIsCounted } from "./notes";

interface NewPeopleData {
  period: Period;
  filters: Filters;
  /** By the week of each person's first active day, oldest first. */
  weeks: StartWeek[];
}

async function load(ctx: DashboardContext) {
  const ad = adContext(ctx);
  const { weeks, fetchedAt } = await loadNewPeople(ctx, ad);
  return { data: { period: ad.period, filters: ad.filters, weeks }, asOf: oldest(fetchedAt) };
}

/** Days 15–28: the first day is day 1. */
const FROM = RETURN_FROM_DAY + 1;
const TO = RETURN_TO_DAY + 1;
const STILL_OPEN = "Still in their first four weeks";

function View({ data, ctx }: { data: NewPeopleData; ctx: DashboardContext }) {
  const { period, filters, weeks } = data;
  const today = period.end;
  const summary = summariseReturns(weeks, today);
  const rate = share(summary.returned, summary.counted);
  const closed = (w: StartWeek) => returnWindowClosed(w.week, today);

  const counts: LineSeries[] = [
    { key: "new", label: "New people", color: COLORS.one, values: weeks.map((w) => w.newPeople) },
    {
      key: "returned",
      label: `Came back on day ${FROM}–${TO}`,
      color: COLORS.two,
      values: weeks.map((w) => (closed(w) ? w.returned : null)),
      emptyLabel: STILL_OPEN,
    },
  ];
  const rates: LineSeries[] = [
    {
      key: "rate",
      label: "Came back after two weeks",
      color: COLORS.one,
      values: weeks.map((w) => returnRate(w, today)),
      emptyLabel: "No rate yet",
    },
  ];

  return (
    <SectionFrame
      sentence={returnSentence({ summary, start: period.start, weeks: period.weeks })}
      howMeasured={
        <>
          <p>
            <strong>New people</strong> were active for the first time ever in that week, so every week only
            counts people who started then. They match “New” in the lifecycle on Active people.
          </p>
          <p>
            <strong>Came back after two weeks</strong> means active again on any day from day {FROM} to day{" "}
            {TO}, counting their first active day as day 1: in their third or fourth week. Activity in the
            first two weeks doesn’t count, and neither does a return after day {TO}, so every start week is
            measured over the same days.
          </p>
          <p>
            A start week only gets a rate once everyone in it has had their day {TO}, about five weeks after
            the week began. Until then its people count as <strong>still in their first four weeks</strong>,
            and the headline rate leaves them out.
          </p>
          <ActiveNote />
          <WeeksNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="grid gap-4 lg:col-span-6 lg:grid-cols-3">
        <StatTile
          title="New people"
          value={formatNumber(summary.started)}
          caption={`First active in the last ${period.weeks} weeks`}
        />
        <StatTile
          title="Came back after two weeks"
          value={rate === null ? "–" : formatNumber(rate, "percent")}
          caption={
            summary.countedUntil === null
              ? "Nobody has had four weeks yet"
              : `${formatNumber(summary.returned)} of ${plural(summary.counted, "person", "people")} who started by ${formatDayMonth(summary.countedUntil)}, active again on day ${FROM}–${TO}`
          }
        />
        <StatTile
          title={STILL_OPEN}
          value={formatNumber(summary.stillOpen)}
          caption="Started recently; they count once their four weeks are up"
        />
      </div>
      <ChartCard
        className="lg:col-span-6"
        title="New people and how many came back, by start week"
        subtitle={`People active for the first time each week, and how many of them were active again on day ${FROM}–${TO}`}
        legend={<Legend items={counts.map((s) => ({ label: s.label, color: s.color }))} />}
        table={weeklyTable(period, counts)}
      >
        <LineChart {...weeklyChart(period, counts, "New people and how many came back, per start week")} />
      </ChartCard>
      <ChartCard
        className="lg:col-span-6"
        title="Return rate after two weeks, by start week"
        subtitle="Share of each week’s new people who came back; recent weeks have no rate until their four weeks are up"
        table={{
          columns: ["Week of", "New people", `Came back on day ${FROM}–${TO}`, "Return rate"],
          rows: weeks.map((w) => {
            const weekRate = returnRate(w, today);
            return [
              weekCell(period, w.week),
              w.newPeople,
              closed(w) ? w.returned : STILL_OPEN,
              weekRate === null
                ? closed(w)
                  ? "No new people"
                  : STILL_OPEN
                : formatNumber(weekRate, "percent"),
            ];
          }),
        }}
      >
        <LineChart {...weeklyChart(period, rates, "Return rate after two weeks per start week", "percent")} />
      </ChartCard>
    </SectionFrame>
  );
}

export const newPeopleSection: SectionModule<NewPeopleData> = {
  slug: "new-people",
  label: "New people",
  load,
  View,
};
