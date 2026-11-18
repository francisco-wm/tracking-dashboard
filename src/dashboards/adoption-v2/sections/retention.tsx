// Named exports: dotted compound access (TableRoot) is not available from a server component.
import {
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@wingmaite/starling-ui";

import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { InfoTip } from "@/components/charts/info-tip";
import { LifecycleChart } from "@/components/charts/lifecycle-chart";
import { DROPPED_OFF, LIFECYCLE_SEGMENTS } from "@/components/charts/lifecycle-segments";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import type { DashboardContext, SectionModule } from "@/dashboards/types";
import { formatDayMonth } from "@/lib/dates";

import { weeklyTicks, weekLabel } from "../../adoption/chart-props";
import { markers, ratio, small, weekCell } from "../chart";
import { COHORT_SPAN, COHORT_WEEKS } from "../config";
import { loadPersonWeeks, v2Context } from "../data";
import type { Filters, Period } from "../filters";
import { cohortTable, composition, weightedRetention, type CohortRow, type CompositionWeek } from "../logic";
import { INFO } from "../info";
import { retentionSentence } from "../sentences";
import { CoreActionNote, MarkersNote, SmallNote, WeeksNote, WhoIsCounted } from "./notes";

interface RetentionData {
  period: Period;
  filters: Filters;
  cohorts: CohortRow[];
  weeks: CompositionWeek[];
}

async function load(ctx: DashboardContext) {
  const v = v2Context(ctx);
  const { people, fetchedAt } = await loadPersonWeeks(ctx, v);
  return {
    data: {
      period: v.period,
      filters: v.filters,
      cohorts: cohortTable(people, v.period.lastWeek),
      weeks: composition(people, v.period.mondays),
    },
    asOf: fetchedAt,
  };
}

const SPAN = Array.from({ length: COHORT_SPAN + 1 }, (_, k) => k);

function View({ data, ctx }: { data: RetentionData; ctx: DashboardContext }) {
  const { period, filters, cohorts, weeks } = data;
  const week1 = weightedRetention(cohorts, 1);
  const week4 = weightedRetention(cohorts, 4);

  return (
    <SectionFrame
      sentence={retentionSentence({ week1, week4 })}
      howMeasured={
        <>
          <p>
            Each <strong>cohort</strong> is the people who registered (<code>user_created</code>) in one
            Monday week, the last {COHORT_WEEKS} complete ones, newest first. <strong>Week 0</strong> is the
            registration week; each cell is the share of the cohort with a core action in that week. Weeks
            that aren’t complete yet are left empty. <strong>Week-1</strong> and{" "}
            <strong>week-4 retention</strong> add up every cohort that has reached that week, so bigger
            cohorts weigh more.
          </p>
          <p>
            Each week, every active person is one of: <strong>new</strong> (registered that week),{" "}
            <strong>returning</strong> (active this week and last week) or{" "}
            <strong>came back after a break</strong> (active this week, not last week, registered earlier).{" "}
            <strong>Dropped off</strong> counts people active last week but not this week, below the line.
            People who registered before November 2025 have no registration event and are never new.
          </p>
          <SmallNote />
          <CoreActionNote />
          <MarkersNote />
          <WeeksNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-3">
        <StatTile
          title="Week-1 retention"
          info={INFO.week1}
          value={ratio(week1.active, week1.size)}
          caption="Active again in the week after registering"
        />
        <StatTile
          title="Week-4 retention"
          info={INFO.week4}
          value={ratio(week4.active, week4.size)}
          caption="Active in their fourth week"
        />
      </div>
      <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-background-light p-5 lg:col-span-6">
        <header className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-title-sm font-medium leading-snug">Registration cohorts</h3>
            <p className="mt-0.5 text-body-sm text-text-secondary">
              Share of each week’s new people with a core action in the weeks after
            </p>
          </div>
          <InfoTip title="Registration cohorts" text={INFO.cohorts} />
        </header>
        <div className="overflow-auto">
          <TableRoot density="sm">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Registered</TableHeaderCell>
                <TableHeaderCell>People</TableHeaderCell>
                {SPAN.map((k) => (
                  <TableHeaderCell key={k}>Week {k}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.map((row) => (
                <TableRow key={row.week}>
                  <TableCell>Week of {formatDayMonth(row.week)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(row.size)}</TableCell>
                  {row.active.map((value, k) => (
                    <TableCell
                      key={k}
                      className={`whitespace-nowrap tabular-nums ${small(row.size) ? "text-text-secondary" : ""}`}
                    >
                      {value === null || row.size === 0 ? "" : ratio(value, row.size)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </TableRoot>
        </div>
      </section>
      <ChartCard
        className="lg:col-span-6"
        title="Who was active each week"
        info={INFO.composition}
        subtitle="Active people by type; dropped off below the line"
        legend={
          <Legend
            items={[
              ...[...LIFECYCLE_SEGMENTS]
                .reverse()
                .map((s) => ({ label: s.label, color: s.color, shape: "rect" as const })),
              { label: DROPPED_OFF.label, color: DROPPED_OFF.color, shape: "rect" },
            ]}
          />
        }
        table={{
          columns: ["Week of", "Came back after a break", "New", "Returning", "Dropped off"],
          rows: weeks.map((w) => [
            weekCell(period, w.week),
            w.cameBack,
            w.newPeople,
            w.returning,
            w.droppedOff,
          ]),
        }}
      >
        <LifecycleChart
          ariaLabel="Active people each week by type"
          bars={weeks.map((w) => ({
            label: formatDayMonth(w.week),
            title: weekLabel(period, w.week),
            returning: w.returning,
            newPeople: w.newPeople,
            cameBack: w.cameBack,
            droppedOff: w.droppedOff,
          }))}
          xTickIndices={weeklyTicks(weeks.length)}
          markers={markers(period)}
          partialIndex={weeks.length - 1}
        />
      </ChartCard>
    </SectionFrame>
  );
}

export const retentionSection: SectionModule<RetentionData> = {
  slug: "retention",
  label: "Retention",
  load,
  View,
};
