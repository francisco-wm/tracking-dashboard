import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { StatCompare } from "@/components/charts/stat-compare";
import { NoSendYet, SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { formatDayMonth } from "@/lib/dates";

import {
  beforeAfterChart,
  beforeAfterLegend,
  beforeAfterTable,
  COLORS,
  runningPairs,
  weeklyChart,
  weeklyTable,
} from "../chart-props";
import {
  kcContext,
  LISTING_LOOKBACK_DAYS,
  loadFirstTimeCreators,
  loadListingsLast60,
  loadTrackingStart,
  loadWeekly,
  loadWindowDaily,
  loadWindowUniques,
  type KCContext,
  type UniqueCompare,
} from "../data";
import { contributingSentence } from "../sentences";
import { longestZeroRun, WINDOW_DAYS, type DayPair, type ZeroRun } from "../windows";
import { WhoIsCounted, trackingCaveat, WeeklyNote } from "./notes";

/** Show a note when new listings were zero for this many days in a row. */
const ZERO_RUN_NOTE_DAYS = 10;

interface ContributingData {
  kc: KCContext;
  listings: DayPair[];
  creators: DayPair[];
  relists: DayPair[];
  contributing: UniqueCompare;
  weekly: { contributions: number[]; contributors: number[]; listings: number[]; relists: number[] };
  zeroRun: ZeroRun | null;
  caveats: string[];
}

async function load(ctx: DashboardContext) {
  const kc = kcContext(ctx);
  if (!kc) return { data: null, asOf: new Date().toISOString() };
  const [daily, creators, uniques, weekly, last60, tracking] = await Promise.all([
    loadWindowDaily(ctx, kc),
    loadFirstTimeCreators(ctx, kc),
    loadWindowUniques(ctx, kc),
    loadWeekly(ctx, kc),
    loadListingsLast60(ctx, kc),
    loadTrackingStart(ctx, kc),
  ]);
  const beforeStart = kc.windows.before.start;
  const caveats = [
    trackingCaveat("Listing new knowledge", tracking.firstSeen.newListing, beforeStart),
    trackingCaveat("Re-listing", tracking.firstSeen.relist, beforeStart),
    trackingCaveat("Contributing", tracking.firstSeen.contribution, beforeStart),
  ].filter((c): c is string => c !== null);

  return {
    data: {
      kc,
      listings: runningPairs(kc.windows, daily.counts.new_listings),
      creators: runningPairs(kc.windows, creators.counts),
      relists: runningPairs(kc.windows, daily.counts.relists),
      contributing: uniques.contributing,
      weekly: {
        contributions: weekly.values.contributions,
        contributors: weekly.values.contributors,
        listings: weekly.values.new_listings,
        relists: weekly.values.relists,
      },
      zeroRun: longestZeroRun(last60.days),
      caveats,
    },
    asOf: oldest(
      daily.fetchedAt,
      creators.fetchedAt,
      uniques.fetchedAt,
      weekly.fetchedAt,
      last60.fetchedAt,
      tracking.fetchedAt,
    ),
  };
}

function View({ data, ctx }: { data: ContributingData | null; ctx: DashboardContext }) {
  if (!data) return <NoSendYet />;
  const { kc, listings, creators, relists, contributing, weekly, zeroRun } = data;
  const { daysElapsed } = kc.windows;
  const at = (pairs: DayPair[]) => pairs[daysElapsed - 1];

  const notes: string[] = [...data.caveats];
  if (zeroRun && zeroRun.length >= ZERO_RUN_NOTE_DAYS) {
    notes.unshift(
      `No new knowledge was listed for ${zeroRun.length} days in a row (${formatDayMonth(zeroRun.start)} – ${formatDayMonth(zeroRun.end)}) within the last ${LISTING_LOOKBACK_DAYS} days. That is either a quiet stretch or a tracking gap, so read listing comparisons with care.`,
    );
  }

  const contributionsSeries: LineSeries[] = [
    { key: "contributions", label: "Contributions", color: COLORS.one, values: weekly.contributions },
  ];
  const contributorsSeries: LineSeries[] = [
    { key: "contributors", label: "People contributing", color: COLORS.one, values: weekly.contributors },
  ];
  const listingSeries: LineSeries[] = [
    { key: "listings", label: "New knowledge listed", color: COLORS.one, values: weekly.listings },
    { key: "relists", label: "Re-listed", color: COLORS.two, values: weekly.relists },
  ];

  const overlay = (title: string, subtitle: string, pairs: DayPair[], unit: string) => (
    <ChartCard
      className="lg:col-span-3"
      title={title}
      subtitle={subtitle}
      legend={<Legend items={beforeAfterLegend(kc.windows)} />}
      table={beforeAfterTable(pairs, unit)}
    >
      <LineChart
        {...beforeAfterChart(pairs, kc.windows, `${title}, before vs after the send`)}
        height={220}
      />
    </ChartCard>
  );

  return (
    <SectionFrame
      sentence={contributingSentence({
        daysElapsed,
        after: at(listings).after ?? 0,
        before: at(listings).before,
        firstTimeCreators: at(creators).after ?? 0,
      })}
      notes={notes}
      howMeasured={
        <>
          <p>
            <strong>New knowledge listed</strong> counts fragments that went from draft to published for the
            first time (<code>kp_status_changed</code>, draft → published). <strong>Re-listed</strong> counts
            already-listed fragments that were edited and published again (
            <code>knowledge_piece_republished</code>).
          </p>
          <p>
            <strong>First-time creators</strong> are people whose first-ever new listing, across all history,
            falls in the window. Each person counts once. This is the closest number to what the email asks
            for.
          </p>
          <p>
            <strong>Contributions</strong> are messages in knowledge-creation chats (
            <code>knowledge_shared</code>, one event per message). This is a creation signal, not consumption:
            it says someone shared knowledge, not that anyone used it.
          </p>
          <p>
            Running totals are matched day by day and the after line stops at today. “Before, same days”
            covers as many before-window days as have passed since the send.
          </p>
          <WeeklyNote />
          <WhoIsCounted ctx={ctx} />
        </>
      }
    >
      {overlay(
        "New knowledge listed, running total",
        "First-time listings, draft → published",
        listings,
        "Listed",
      )}
      {overlay(
        "First-time creators, running total",
        "People listing knowledge for the very first time",
        creators,
        "Creators",
      )}
      {overlay("Knowledge re-listed, running total", "Edited and published again", relists, "Re-listed")}
      <div className="lg:col-span-3">
        <StatCompare
          title="People contributing knowledge"
          after={contributing.after}
          beforeMatched={contributing.beforeMatched}
          beforeFull={contributing.beforeFull}
          daysElapsed={daysElapsed}
          totalDays={WINDOW_DAYS}
        />
      </div>
      <ChartCard
        className="lg:col-span-3"
        title="Contributions, weekly"
        subtitle="Messages in knowledge-creation chats"
        table={weeklyTable(kc, contributionsSeries)}
      >
        <LineChart {...weeklyChart(kc, contributionsSeries, "Contributions per week")} height={220} />
      </ChartCard>
      <ChartCard
        className="lg:col-span-3"
        title="People contributing, weekly"
        subtitle="Unique people per week"
        table={weeklyTable(kc, contributorsSeries)}
      >
        <LineChart {...weeklyChart(kc, contributorsSeries, "People contributing per week")} height={220} />
      </ChartCard>
      <ChartCard
        className="lg:col-span-6"
        title="Listings and re-lists, weekly"
        subtitle="Last 6 months, Monday-start weeks"
        legend={<Legend items={listingSeries.map((s) => ({ label: s.label, color: s.color }))} />}
        table={weeklyTable(kc, listingSeries)}
      >
        <LineChart {...weeklyChart(kc, listingSeries, "New listings and re-lists per week")} />
      </ChartCard>
    </SectionFrame>
  );
}

export const contributingSection: SectionModule<ContributingData | null> = {
  slug: "contributing",
  label: "Contributing",
  load,
  View,
};
