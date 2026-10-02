import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

import { COLORS, dailyChart, dailyTable } from "../chart-props";
import { feContext, loadListingsDaily, loadListingTotals } from "../data";
import type { Filters, Period } from "../filters";
import { editsListedSentence, plural } from "../sentences";
import { PeriodNote, TimelineNote, WhoIsCounted } from "./notes";

interface EditsListedData {
  period: Period;
  filters: Filters;
  newListings: number;
  relists: number;
  relistedFragments: number;
  daily: { newListings: number[]; relists: number[] };
}

async function load(ctx: DashboardContext) {
  const fe = feContext(ctx);
  const [totals, daily] = await Promise.all([loadListingTotals(ctx, fe), loadListingsDaily(ctx, fe)]);
  return {
    data: {
      period: fe.period,
      filters: fe.filters,
      newListings: totals.newListings,
      relists: totals.relists,
      relistedFragments: totals.relistedFragments,
      daily: { newListings: daily.newListings, relists: daily.relists },
    },
    asOf: oldest(totals.fetchedAt, daily.fetchedAt),
  };
}

function View({ data, ctx }: { data: EditsListedData; ctx: DashboardContext }) {
  const { period, filters, newListings, relists, relistedFragments, daily } = data;
  const allListings = newListings + relists;

  const series: LineSeries[] = [
    { key: "new", label: "New knowledge listed", color: COLORS.one, values: daily.newListings },
    { key: "edits", label: "Edits listed", color: COLORS.two, values: daily.relists },
  ];

  return (
    <SectionFrame
      sentence={editsListedSentence({ days: period.days, fragments: relistedFragments, newListings })}
      howMeasured={
        <>
          <p>
            <strong>Edits listed</strong> counts every time someone edited a fragment that was already listed
            and published the changes (<code>knowledge_piece_republished</code>).{" "}
            <strong>Edited fragments listed</strong> counts each fragment once, however often it was
            re-listed.
          </p>
          <p>
            <strong>New knowledge listed</strong> counts fragments that went from draft to published for the
            first time (<code>kp_status_changed</code>, draft → published).
          </p>
          <p>
            <strong>Share of listings that were edits</strong> is edits listed divided by everything listed
            (edits plus new knowledge).
          </p>
          <PeriodNote days={period.days} />
          <TimelineNote />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="lg:col-span-2">
        <StatTile
          title="Edited fragments listed"
          value={formatNumber(relistedFragments)}
          caption={
            relists === relistedFragments
              ? "Edited and published again"
              : `${plural(relists, "re-listing")} in total; some fragments were re-listed more than once`
          }
        />
      </div>
      <div className="lg:col-span-2">
        <StatTile
          title="New knowledge listed"
          value={formatNumber(newListings)}
          caption="Fragments listed for the first time"
        />
      </div>
      <div className="lg:col-span-2">
        <StatTile
          title="Share of listings that were edits"
          value={allListings > 0 ? formatNumber(relists / allListings, "percent") : "–"}
          caption={`${formatNumber(relists)} of ${plural(allListings, "listing")}`}
        />
      </div>
      <ChartCard
        className="lg:col-span-6"
        title="New knowledge vs edits listed, daily"
        subtitle="Fragments listed for the first time, and edits to listed fragments that went live"
        legend={<Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
        table={dailyTable(period, series)}
      >
        <LineChart {...dailyChart(period, series, "New knowledge listed and edits listed per day")} />
      </ChartCard>
    </SectionFrame>
  );
}

export const editsListed: SectionModule<EditsListedData> = {
  slug: "edits-listed",
  label: "Edits listed",
  load,
  View,
};
