import { ChartCard } from "@/components/charts/chart-card";
import { Funnel } from "@/components/charts/funnel";
import { Legend } from "@/components/charts/legend";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import { COLORS, weeklyLines, weeklyTable } from "../chart";
import { citationsDay, loadAnswers, loadOrganisations, loadWeekly, v2Context, type Week } from "../data";
import { share, trailingAverage, weekIndex, type Filters, type Period } from "../filters";
import { INFO } from "../info";
import { headline, median } from "../logic";
import { averageCaption, headlineSentence } from "../sentences";
import { CoreActionNote, GapNote, MarkersNote, SourcedNote, WeeksNote, WhoIsCounted } from "./notes";

interface HeadlineData {
  period: Period;
  filters: Filters;
  since: ISODate;
  weeks: Week[];
  /** Chat messages and sourced answers per week; null before citations. */
  questions: (number | null)[];
  sourced: (number | null)[];
  orgs: number;
  seats: number;
  /** Each organisation's seat activation last week. */
  orgActivation: number[];
}

async function load(ctx: DashboardContext) {
  const v = v2Context(ctx);
  const [weekly, answers, orgs] = await Promise.all([
    loadWeekly(ctx, v),
    loadAnswers(ctx, v),
    loadOrganisations(ctx, v),
  ]);
  const withSeats = orgs.rows.filter((o) => o.seats > 0);
  return {
    data: {
      period: v.period,
      filters: v.filters,
      since: citationsDay(v),
      weeks: weekly.weeks,
      questions: answers.weeks.map((w) => w.questions),
      sourced: answers.weeks.map((w) => w.sourced),
      orgs: withSeats.length,
      seats: withSeats.reduce((sum, o) => sum + o.seats, 0),
      orgActivation: withSeats.map((o) => o.weeks[3] / o.seats),
    },
    asOf: oldest(weekly.fetchedAt, answers.fetchedAt, orgs.fetchedAt),
  };
}

function View({ data, ctx }: { data: HeadlineData; ctx: DashboardContext }) {
  const { period, filters, since, weeks, questions, sourced, orgs, seats, orgActivation } = data;
  const last = weekIndex(period, period.lastWeek);
  const lw = weeks[last];
  const active = weeks.map((w) => w.active);
  const gapRate = questions.map((q, i) => (q ? (q - (sourced[i] ?? 0)) / q : null));
  const lastQuestions = questions[last];
  const lastSourced = sourced[last];
  const medianActivation = median(orgActivation);

  const activeSeries: LineSeries = {
    key: "active",
    label: "Active people",
    color: COLORS.one,
    values: active,
  };
  const averageSeries: LineSeries = {
    key: "average",
    label: "4-week average",
    color: COLORS.two,
    values: trailingAverage(active, 4),
    emptyLabel: "Needs 4 full weeks",
  };
  const answerSeries: LineSeries[] = [
    {
      key: "questions",
      label: "Chat messages",
      color: COLORS.one,
      values: questions,
      emptyLabel: "Not tracked",
    },
    {
      key: "sourced",
      label: "With a sourced answer",
      color: COLORS.two,
      values: sourced,
      emptyLabel: "Not tracked",
    },
  ];

  return (
    <SectionFrame
      sentence={headlineSentence({
        week: period.lastWeek,
        active: lw.active,
        questions: lastQuestions,
        sourced: lastSourced,
      })}
      howMeasured={
        <>
          <CoreActionNote />
          <SourcedNote since={since} />
          <GapNote />
          <p>
            Tiles show <strong>last week</strong>, the latest complete one, with the average of the 4 weeks
            ending with it and how that average compares with the 4 weeks before. An{" "}
            <strong>active organisation</strong> had an active person that week, out of every organisation
            with at least one seat. <strong>Seats</strong> are approximate: PostHog has no seat count, so they
            are the people seen on an organisation’s events, minus anyone who left. <strong>Invited</strong>{" "}
            registrations accepted an invite; the rest registered themselves.{" "}
            <strong>What active people did</strong> counts each person once per action, so someone who chatted
            and uploaded a file counts in both.
          </p>
          <MarkersNote />
          <WeeksNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-3">
        <StatTile
          title="Sourced answers (north star)"
          info={INFO.sourced}
          value={lastSourced === null ? "–" : formatNumber(lastSourced)}
          caption={averageCaption(headline(sourced, last))}
        />
        <StatTile
          title="Active people"
          info={INFO.active}
          value={formatNumber(lw.active)}
          caption={averageCaption(headline(active, last))}
        />
        <StatTile
          title="Active organisations"
          info={INFO.orgs}
          value={`${formatNumber(lw.orgs)} of ${formatNumber(orgs)}`}
          caption={averageCaption(
            headline(
              weeks.map((w) => w.orgs),
              last,
            ),
          )}
        />
        <StatTile
          title="Seat activation"
          info={INFO.seats}
          value={formatNumber(share(lw.active, seats) ?? 0, "percent")}
          caption={`${formatNumber(lw.active)} active of ${formatNumber(seats)} seats · median organisation ${
            medianActivation === null ? "–" : formatNumber(medianActivation, "percent")
          }`}
        />
        <StatTile
          title="Knowledge gap rate"
          info={INFO.gap}
          value={lastQuestions ? formatNumber(gapRate[last] ?? 0, "percent") : "–"}
          caption={
            lastQuestions
              ? `${formatNumber(lastQuestions - (lastSourced ?? 0))} of ${formatNumber(lastQuestions)} chat messages uncited · ${averageCaption(headline(gapRate, last), "percent")}`
              : `Tracked since ${formatDayMonth(since)}`
          }
        />
        <StatTile
          title="New registrations"
          info={INFO.registrations}
          value={formatNumber(lw.registrations)}
          caption={`${formatNumber(lw.invited)} invited · ${formatNumber(lw.registrations - lw.invited)} self-registered`}
        />
      </div>
      <ChartCard
        className="lg:col-span-6"
        title="Weekly active people"
        info={INFO.activeChart}
        subtitle="People with at least one core action that week, and the 4-week average"
        legend={
          <Legend items={[activeSeries, averageSeries].map((s) => ({ label: s.label, color: s.color }))} />
        }
        table={weeklyTable(period, [activeSeries, averageSeries])}
      >
        <LineChart
          {...weeklyLines(
            period,
            [activeSeries, averageSeries],
            "Active people per week, with a 4-week average",
          )}
        />
      </ChartCard>
      <div className="lg:col-span-6">
        <Funnel
          title="What active people did"
          subtitle={`Week of ${formatDayMonth(period.lastWeek)}; share of everyone active, and one person can do several`}
          info={INFO.doing}
          numbered={false}
          steps={[
            { label: "Active people", count: lw.active },
            ...(
              [
                ["Sent a chat message", lw.doing.chatting],
                ["Wrote a draft", lw.doing.drafting],
                ["Uploaded a file to company knowledge", lw.doing.uploading],
                ["Edited a fragment", lw.doing.editing],
                ["Listed a fragment (new or edited)", lw.doing.listing],
                ["Attached a file in a chat", lw.doing.attaching],
                ["Sent a knowledge request", lw.doing.requesting],
                ["Answered a knowledge request", lw.doing.answering],
              ] as const
            )
              .map(([label, count]) => ({ label, count }))
              .sort((a, b) => b.count - a.count),
          ]}
        />
      </div>
      <ChartCard
        className="lg:col-span-6"
        title="Weekly sourced answers"
        info={INFO.sourcedChart}
        subtitle={`Chat messages, and how many got a sourced answer; tracked since ${formatDayMonth(since)}`}
        legend={<Legend items={answerSeries.map((s) => ({ label: s.label, color: s.color }))} />}
        table={weeklyTable(period, answerSeries)}
      >
        <LineChart {...weeklyLines(period, answerSeries, "Chat messages and sourced answers per week")} />
      </ChartCard>
    </SectionFrame>
  );
}

export const headlineSection: SectionModule<HeadlineData> = {
  slug: "headline",
  label: "Headline",
  load,
  View,
};
