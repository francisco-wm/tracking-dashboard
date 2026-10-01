import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LifecycleChart } from "@/components/charts/lifecycle-chart";
import { DROPPED_OFF, LIFECYCLE_SEGMENTS } from "@/components/charts/lifecycle-segments";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { StatCompare } from "@/components/charts/stat-compare";
import { NoSendYet, SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { formatDayMonth, mondayOf } from "@/lib/dates";

import { COLORS, weekTitle, weeklyChart, weeklyMarkers, weeklyTable } from "../chart-props";
import {
  kcContext,
  loadLifecycle,
  loadWeekly,
  loadWindowUniques,
  type KCContext,
  type LifecycleWeek,
  type UniqueCompare,
} from "../data";
import { comingBackSentence } from "../sentences";
import { WINDOW_DAYS } from "../windows";
import { EveryoneCounted, WeeklyNote } from "./notes";

/** How many full weeks before the send week make up "a typical week". */
const TYPICAL_WEEKS = 8;

interface ComingBackData {
  kc: KCContext;
  lifecycle: LifecycleWeek[];
  active: UniqueCompare;
  questionsPerActive: (number | null)[];
  contributionsPerActive: (number | null)[];
}

async function load(ctx: DashboardContext) {
  const kc = kcContext(ctx);
  if (!kc) return { data: null, asOf: new Date().toISOString() };
  const [lifecycle, uniques, weekly] = await Promise.all([
    loadLifecycle(ctx, kc),
    loadWindowUniques(ctx, kc),
    loadWeekly(ctx, kc),
  ]);
  const perActive = (values: number[]) =>
    values.map((v, i) => {
      const active = weekly.values.active_people[i];
      return active > 0 ? v / active : null;
    });
  return {
    data: {
      kc,
      lifecycle: lifecycle.rows,
      active: uniques.active,
      questionsPerActive: perActive(weekly.values.questions),
      contributionsPerActive: perActive(weekly.values.contributions),
    },
    asOf: oldest(lifecycle.fetchedAt, uniques.fetchedAt, weekly.fetchedAt),
  };
}

function typicalCameBack(rows: LifecycleWeek[], sendWeekIndex: number): number | null {
  const before = rows.slice(Math.max(0, sendWeekIndex - TYPICAL_WEEKS), sendWeekIndex);
  if (before.length === 0) return null;
  const mean = before.reduce((sum, r) => sum + r.cameBack, 0) / before.length;
  return Math.round(mean * 10) / 10;
}

function View({ data }: { data: ComingBackData | null }) {
  if (!data) return <NoSendYet />;
  const { kc, lifecycle, active } = data;
  const sendWeek = mondayOf(kc.windows.send);
  const sendWeekIndex = kc.weekly.weeks.indexOf(sendWeek);
  const sendRow = lifecycle[sendWeekIndex];
  const partialIndex = kc.weekly.weeks.indexOf(kc.weekly.partialWeek);

  const perActiveSeries: LineSeries[] = [
    {
      key: "questions",
      label: "Questions per active person",
      color: COLORS.one,
      values: data.questionsPerActive,
    },
    {
      key: "contributions",
      label: "Contributions per active person",
      color: COLORS.two,
      values: data.contributionsPerActive,
    },
  ];

  const sentence = sendRow
    ? comingBackSentence({
        cameBack: sendRow.cameBack,
        typical: typicalCameBack(lifecycle, sendWeekIndex),
        sendWeekInProgress: sendWeek === kc.weekly.partialWeek,
      })
    : `The send week of ${formatDayMonth(sendWeek)} is outside the last 6 months.`;

  return (
    <SectionFrame
      sentence={sentence}
      howMeasured={
        <>
          <p>
            <strong>Active</strong> means at least one page view (<code>$pageview</code>) in a Monday-start
            week. Each week, every active person is one of: <strong>new</strong> (their first active week
            ever), <strong>returning</strong> (active this week and last week) or{" "}
            <strong>came back after a break</strong> (active this week, not last week, and not new).{" "}
            <strong>Dropped off</strong> counts people active last week but not this week, shown below the
            line.
          </p>
          <p>
            A bump in “came back after a break” in a send week is the clearest sign the email reminded people.
            “A typical week” is the average of the {TYPICAL_WEEKS} weeks before the send week. The current
            week is still in progress, so its “dropped off” bar includes people who simply haven’t come in
            yet.
          </p>
          <p>
            <strong>Per active person</strong> divides weekly questions and contributions by that week’s
            active people. If activity rose only because more people showed up, these lines stay flat.
          </p>
          <WeeklyNote />
          <EveryoneCounted />
        </>
      }
    >
      <ChartCard
        className="lg:col-span-6"
        title="Did people come back? Weekly lifecycle"
        subtitle="People active each week by type; dropped off below the line"
        legend={
          <Legend
            items={[
              ...[...LIFECYCLE_SEGMENTS]
                .reverse()
                .map((s) => ({ label: s.label, color: s.color, shape: "rect" as const })),
              { label: DROPPED_OFF.label, color: DROPPED_OFF.color, shape: "rect" },
              { label: "Email sent", color: "var(--color-chart-marker)", shape: "dashed" },
            ]}
          />
        }
        table={{
          columns: ["Week of", "Came back after a break", "New", "Returning", "Dropped off"],
          rows: lifecycle.map((r) => [
            weekTitle(kc, r.week).replace("Week of ", ""),
            r.cameBack,
            r.newPeople,
            r.returning,
            r.droppedOff,
          ]),
        }}
      >
        <LifecycleChart
          ariaLabel="Weekly lifecycle of active people"
          bars={lifecycle.map((r) => ({
            label: formatDayMonth(r.week),
            title: weekTitle(kc, r.week),
            returning: r.returning,
            newPeople: r.newPeople,
            cameBack: r.cameBack,
            droppedOff: r.droppedOff,
          }))}
          xTickIndices={weeklyChart(kc, [], "").xTickIndices}
          markers={weeklyMarkers(kc)}
          partialIndex={partialIndex}
        />
      </ChartCard>
      <div className="lg:col-span-2">
        <StatCompare
          title="Active people"
          after={active.after}
          beforeMatched={active.beforeMatched}
          beforeFull={active.beforeFull}
          daysElapsed={kc.windows.daysElapsed}
          totalDays={WINDOW_DAYS}
        />
      </div>
      <ChartCard
        className="lg:col-span-4"
        title="Questions and contributions per active person, weekly"
        subtitle="Weekly counts divided by that week’s active people"
        legend={<Legend items={perActiveSeries.map((s) => ({ label: s.label, color: s.color }))} />}
        table={weeklyTable(kc, perActiveSeries, "decimal")}
      >
        <LineChart
          {...weeklyChart(
            kc,
            perActiveSeries,
            "Questions and contributions per active person per week",
            "decimal",
          )}
        />
      </ChartCard>
    </SectionFrame>
  );
}

export const comingBack: SectionModule<ComingBackData | null> = {
  slug: "coming-back",
  label: "Coming back",
  load,
  View,
};
