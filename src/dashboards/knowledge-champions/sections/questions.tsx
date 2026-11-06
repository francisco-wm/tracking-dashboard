import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart } from "@/components/charts/line-chart";
import { StatCompare } from "@/components/charts/stat-compare";
import { NoSendYet, SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

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
  loadWeekly,
  loadWindowDaily,
  loadWindowUniques,
  type KCContext,
  type UniqueCompare,
} from "../data";
import { questionsSentence } from "../sentences";
import { WINDOW_DAYS, type DayPair } from "../windows";
import { EveryoneCounted, WeeklyNote } from "./notes";

interface QuestionsData {
  kc: KCContext;
  pairs: DayPair[];
  asking: UniqueCompare;
  weeklyQuestions: number[];
  weeklyAsking: number[];
}

async function load(ctx: DashboardContext) {
  const kc = kcContext(ctx);
  if (!kc) return { data: null, asOf: new Date().toISOString() };
  const [daily, uniques, weekly] = await Promise.all([
    loadWindowDaily(ctx, kc),
    loadWindowUniques(ctx, kc),
    loadWeekly(ctx, kc),
  ]);
  return {
    data: {
      kc,
      pairs: runningPairs(kc.windows, daily.counts.questions),
      asking: uniques.asking,
      weeklyQuestions: weekly.values.questions,
      weeklyAsking: weekly.values.people_asking,
    },
    asOf: oldest(daily.fetchedAt, uniques.fetchedAt, weekly.fetchedAt),
  };
}

function View({ data }: { data: QuestionsData | null }) {
  if (!data) return <NoSendYet />;
  const { kc, pairs, asking } = data;
  const { daysElapsed } = kc.windows;
  const today = pairs[daysElapsed - 1];

  const questionsSeries = [
    { key: "questions", label: "Chat messages sent", color: COLORS.one, values: data.weeklyQuestions },
  ];
  const askingSeries = [
    { key: "asking", label: "People chatting", color: COLORS.one, values: data.weeklyAsking },
  ];

  return (
    <SectionFrame
      sentence={questionsSentence({ daysElapsed, after: today.after ?? 0, before: today.before })}
      howMeasured={
        <>
          <p>
            <strong>Chat messages sent</strong> counts every message sent in a regular chat (
            <code>chat_message_sent</code> with chat type <code>chat</code>). The running totals are matched
            day by day: day 1 is the send day for “after” and the first of the 14 days before the send for
            “before”. The after line stops at today.
          </p>
          <p>
            <strong>People chatting</strong> counts unique people who sent at least one such message. “Before,
            same days” covers as many days of the before window as have passed since the send, so the two
            numbers stay comparable while the after window fills up.
          </p>
          <WeeklyNote />
          <EveryoneCounted />
        </>
      }
    >
      <ChartCard
        className="lg:col-span-4"
        title="Chat messages sent, running total"
        subtitle="Messages in regular chats, matched by day after the send"
        legend={<Legend items={beforeAfterLegend(kc.windows)} />}
        table={beforeAfterTable(pairs, "Chat messages")}
      >
        <LineChart
          {...beforeAfterChart(
            pairs,
            kc.windows,
            "Chat messages sent, running total, before vs after the send",
          )}
        />
      </ChartCard>
      <div className="lg:col-span-2">
        <StatCompare
          title="People chatting"
          after={asking.after}
          beforeMatched={asking.beforeMatched}
          beforeFull={asking.beforeFull}
          daysElapsed={daysElapsed}
          totalDays={WINDOW_DAYS}
        />
      </div>
      <ChartCard
        className="lg:col-span-3"
        title="Chat messages sent, weekly"
        subtitle="Last 6 months, Monday-start weeks"
        table={weeklyTable(kc, questionsSeries)}
      >
        <LineChart {...weeklyChart(kc, questionsSeries, "Chat messages sent per week")} />
      </ChartCard>
      <ChartCard
        className="lg:col-span-3"
        title="People chatting, weekly"
        subtitle="Unique people per week"
        table={weeklyTable(kc, askingSeries)}
      >
        <LineChart {...weeklyChart(kc, askingSeries, "People chatting per week")} />
      </ChartCard>
    </SectionFrame>
  );
}

export const questions: SectionModule<QuestionsData | null> = {
  slug: "questions",
  label: "Chat messages",
  load,
  View,
};
