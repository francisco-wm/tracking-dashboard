import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import { COLORS, ratio, weeklyLines, weeklyTable } from "../chart";
import {
  citationsDay,
  loadAnswers,
  loadRequests,
  loadReuse,
  loadWeekly,
  v2Context,
  type Week,
} from "../data";
import { weekIndex, type Filters, type Period } from "../filters";
import { plural } from "../../adoption/sentences";
import { INFO } from "../info";
import { loopSentence } from "../sentences";
import { CoreActionNote, GapNote, MarkersNote, SourcedNote, WeeksNote, WhoIsCounted } from "./notes";

interface LoopData {
  period: Period;
  filters: Filters;
  since: ISODate;
  weeks: Week[];
  questions: (number | null)[];
  sourced: (number | null)[];
  /** Requests with an answer, by the week sent; null before answers carried the request id. */
  answered: (number | null)[];
  /** Requests resolved by their requester, by the week sent; null likewise. */
  resolved: (number | null)[];
  reuse: { available: number; cited: number; authors: number; contributors: number };
}

async function load(ctx: DashboardContext) {
  const v = v2Context(ctx);
  const [weekly, answers, requests, reuse] = await Promise.all([
    loadWeekly(ctx, v),
    loadAnswers(ctx, v),
    loadRequests(ctx, v),
    loadReuse(ctx, v),
  ]);
  return {
    data: {
      period: v.period,
      filters: v.filters,
      since: citationsDay(v),
      weeks: weekly.weeks,
      questions: answers.weeks.map((w) => w.questions),
      sourced: answers.weeks.map((w) => w.sourced),
      answered: requests.answered,
      resolved: requests.resolved,
      reuse: {
        available: reuse.available,
        cited: reuse.cited,
        authors: reuse.authors,
        contributors: reuse.contributors,
      },
    },
    asOf: oldest(weekly.fetchedAt, answers.fetchedAt, requests.fetchedAt, reuse.fetchedAt),
  };
}

function Chart({
  period,
  title,
  subtitle,
  series,
  info,
  format = "int",
}: {
  info: string;
  period: Period;
  title: string;
  subtitle: string;
  series: LineSeries[];
  format?: "int" | "percent";
}) {
  return (
    <ChartCard
      className="lg:col-span-3"
      title={title}
      subtitle={subtitle}
      info={info}
      legend={<Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
      table={weeklyTable(period, series, format)}
    >
      <LineChart {...weeklyLines(period, series, title, format)} />
    </ChartCard>
  );
}

function View({ data, ctx }: { data: LoopData; ctx: DashboardContext }) {
  const { period, filters, since, weeks, questions, sourced, answered, resolved, reuse } = data;
  const last = weekIndex(period, period.lastWeek);
  const sum = (pick: (w: Week) => number) => weeks.reduce((total, w) => total + pick(w), 0);
  const col = (pick: (w: Week) => number) => weeks.map(pick);
  const color = [COLORS.one, COLORS.two, COLORS.three];
  const lines = (items: [string, string, (number | null)[]][]): LineSeries[] =>
    items.map(([key, label, values], i) => ({
      key,
      label,
      color: color[i],
      values,
      emptyLabel: "Not tracked",
    }));

  return (
    <SectionFrame
      sentence={loopSentence({
        week: period.lastWeek,
        listed: weeks[last].fragmentsListed + weeks[last].fragmentsRelisted,
        uploads: weeks[last].filesUploaded,
        questions: weeks[last].questions,
        sourced: sourced[last],
      })}
      howMeasured={
        <>
          <p>
            <strong>Supply</strong> is knowledge going in, the only knowledge answers can cite:{" "}
            <strong>fragments listed</strong> (a draft shared with the organisation or a group in it,{" "}
            <code>kp_status_changed</code> from draft to published), <strong>edits re-listed</strong> (
            <code>knowledge_piece_republished</code>) and <strong>files uploaded</strong> to company knowledge
            outside a chat (<code>knowledge_piece_created</code> with <code>knowledge_piece_type = file</code>
            , videos included, tracked since February 2026). Drafts and edits don’t count until they are
            listed. Contributors are the people who did any of these. <strong>Demand</strong>: messages in
            regular chats, the people who sent them, and files attached in a chat (
            <code>attached_source</code>), which only serve that chat.
          </p>
          <p>
            <strong>Knowledge cited</strong>: of everything answers can cite today (fragments whose latest
            status is published, and uploaded files, not archived or deleted), how much was cited in the last
            30 days, today included. <strong>Authors cited</strong>: of everyone who created knowledge answers
            can cite today (a listed fragment or an uploaded file), how many had some of it cited in the last
            90 days. A request <strong>has an answer</strong> when at least one{" "}
            <code>knowledge_request_answered</code> carries its id, and is <strong>resolved</strong> when its
            requester closed it as resolved (<code>knowledge_request_closed</code>,{" "}
            <code>outcome = resolved</code>); the old backend carried no request id, so weeks before the new
            tracking have no value.
          </p>
          <SourcedNote since={since} />
          <GapNote />
          <CoreActionNote />
          <MarkersNote />
          <WeeksNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <Chart
        period={period}
        title="Supply"
        info={INFO.supply}
        subtitle={`Knowledge going in, which answers can cite, per week · ${plural(weeks[last].contributors, "contributor")} last week`}
        series={lines([
          ["listed", "Fragments listed", col((w) => w.fragmentsListed)],
          ["relisted", "Edits re-listed", col((w) => w.fragmentsRelisted)],
          ["uploads", "Files uploaded", col((w) => w.filesUploaded)],
        ])}
      />
      <Chart
        period={period}
        title="Demand"
        info={INFO.demand}
        subtitle="Chat messages, the people sending them and files attached in chats, per week"
        series={lines([
          ["questions", "Chat messages", col((w) => w.questions)],
          ["askers", "People", col((w) => w.askers)],
          ["attached", "Files attached in chats", col((w) => w.filesAttached)],
        ])}
      />
      <Chart
        period={period}
        title="Answer quality"
        info={INFO.quality}
        subtitle={`Share of chat messages with a sourced answer · ratings in these weeks: ${formatNumber(sum((w) => w.ratedUp))} up, ${formatNumber(sum((w) => w.ratedDown))} down`}
        format="percent"
        series={lines([
          ["rate", "Sourced answer rate", questions.map((q, i) => (q ? (sourced[i] ?? 0) / q : null))],
        ])}
      />
      <Chart
        period={period}
        title="Knowledge requests"
        info={INFO.requests}
        subtitle="Requests sent per week, and how many of them have an answer or were resolved"
        series={lines([
          ["sent", "Sent", col((w) => w.requests)],
          ["answered", "With an answer", answered],
          ["resolved", "Resolved", resolved],
        ])}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6">
        <StatTile
          title="Knowledge cited, last 30 days"
          info={INFO.listedCited}
          value={ratio(reuse.cited, reuse.available)}
          caption={`Of the listed fragments and uploaded files answers can cite; citations tracked since ${formatDayMonth(since)}`}
        />
        <StatTile
          title="Authors cited, last 90 days"
          info={INFO.authors}
          value={ratio(reuse.authors, reuse.contributors)}
          caption={`Of everyone with listed fragments or uploaded files answers can cite; citations tracked since ${formatDayMonth(since)}`}
        />
      </div>
    </SectionFrame>
  );
}

export const knowledgeLoopSection: SectionModule<LoopData> = {
  slug: "knowledge-loop",
  label: "Knowledge loop",
  load,
  View,
};
