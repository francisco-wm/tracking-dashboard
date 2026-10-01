import { BarChart } from "@/components/charts/bar-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { NoSendYet, SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { formatDayMonth } from "@/lib/dates";

import { COLORS } from "../chart-props";
import { kcContext, loadWindowDaily, loadWindowUniques, type KCContext } from "../data";
import { reachSentence } from "../sentences";
import { EveryoneCounted } from "./notes";

interface ReachData {
  kc: KCContext;
  clickers: number;
  activeSinceSend: number;
  /** Per after-window day; null for days that haven't happened. */
  days: { date: string; clicks: number | null; clickers: number | null }[];
}

async function load(ctx: DashboardContext) {
  const kc = kcContext(ctx);
  if (!kc) return { data: null, asOf: new Date().toISOString() };
  const [daily, uniques] = await Promise.all([loadWindowDaily(ctx, kc), loadWindowUniques(ctx, kc)]);
  const days = kc.windows.after.days.map((date, i) => {
    const happened = i < kc.windows.daysElapsed;
    return {
      date,
      clicks: happened ? (daily.counts.clicks.get(date) ?? 0) : null,
      clickers: happened ? (daily.counts.clickers.get(date) ?? 0) : null,
    };
  });
  return {
    data: { kc, clickers: uniques.clickers, activeSinceSend: uniques.active.after, days },
    asOf: oldest(daily.fetchedAt, uniques.fetchedAt),
  };
}

function View({ data }: { data: ReachData | null }) {
  if (!data) return <NoSendYet />;
  const { kc, clickers, activeSinceSend, days } = data;
  const totalClicks = days.reduce((sum, d) => sum + (d.clicks ?? 0), 0);
  const share = activeSinceSend > 0 ? clickers / activeSinceSend : 0;

  return (
    <SectionFrame
      sentence={reachSentence({ send: kc.windows.send, clickers, activeSinceSend })}
      howMeasured={
        <>
          <p>
            <strong>Clicks</strong> are <code>reach_email_cta_clicked</code> events with source{" "}
            <code>reach_email</code>: someone pressed “Share your knowledge” in the email.{" "}
            <strong>Clickers</strong> are the unique people behind them, since the send.
          </p>
          <p>
            <strong>Share of active people:</strong> there is no “email sent” event, so there is no recipient
            count. Unique people with a page view since the send stand in for the audience, which makes this a
            rough click rate, not a true one.
          </p>
          <p>
            Most email clicks land in the first day or two; clicks later on mean people went back to the
            email.
          </p>
          <EveryoneCounted />
        </>
      }
    >
      <div className="lg:col-span-2">
        <StatTile
          title="Clickers"
          value={formatNumber(clickers)}
          caption="Unique people who clicked since the send"
        />
      </div>
      <div className="lg:col-span-2">
        <StatTile
          title="Clickers as a share of active people"
          value={formatNumber(share, "percent")}
          caption={`${formatNumber(clickers)} of ${formatNumber(activeSinceSend)} people active since the send`}
        />
      </div>
      <div className="lg:col-span-2">
        <StatTile title="Total clicks" value={formatNumber(totalClicks)} caption="Including repeat clicks" />
      </div>
      <ChartCard
        className="lg:col-span-6"
        title="Clicks per day"
        subtitle="The 14 days after the send; days that haven’t happened yet are empty"
        table={{
          columns: ["Day", "Date", "Clicks", "Unique clickers"],
          rows: days.map((d, i) => [
            i + 1,
            formatDayMonth(d.date),
            d.clicks ?? "Not yet",
            d.clickers ?? "Not yet",
          ]),
        }}
      >
        <BarChart
          ariaLabel="Email clicks per day after the send"
          seriesLabel="Clicks"
          color={COLORS.after}
          bars={days.map((d, i) => ({
            label: formatDayMonth(d.date),
            title: `Day ${i + 1} · ${formatDayMonth(d.date)}`,
            value: d.clicks,
          }))}
          xTickIndices={[0, 6, 13]}
        />
      </ChartCard>
    </SectionFrame>
  );
}

export const reach: SectionModule<ReachData | null> = {
  slug: "reach",
  label: "Reach",
  load,
  View,
};
