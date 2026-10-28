import { BarChart, type Bar } from "@/components/charts/bar-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

import { ShareBar } from "../charts/share-bar";
import { WaitingCard } from "../charts/waiting";
import { COLORS, type DataKey } from "../config";
import { krContext, loadRequests, loadTracking } from "../data";
import { share, trackedSince, type Filters, type Period } from "../filters";
import {
  answerSummary,
  formatDuration,
  suggestionSummary,
  type AnswerSummary,
  type SuggestionSummary,
} from "../lifecycle";
import { answersSentence, plural, trackingNote } from "../sentences";
import { isTracked, missing, startedInPeriod } from "../tracking";
import { MediansNote, PeriodNote, RequestsNote, WhoIsCounted, spanLabel } from "./notes";

interface AnswersData {
  period: Period;
  filters: Filters;
  answers: { summary: AnswerSummary } | null;
  suggestions: { summary: SuggestionSummary } | null;
  waiting: { answers: DataKey[]; suggestions: DataKey[] };
  /** Data used here that first appeared inside the range. */
  note: string | null;
}

async function load(ctx: DashboardContext) {
  const kr = krContext(ctx);
  const [tracking, requests] = await Promise.all([loadTracking(ctx, kr), loadRequests(ctx, kr)]);
  const { status } = tracking;
  const ANSWERS: DataKey[] = ["sent", "answered"];
  const SUGGESTIONS: DataKey[] = ["sent", "suggestions"];
  const { rows } = requests;
  return {
    data: {
      period: kr.period,
      filters: kr.filters,
      answers: isTracked(status, ANSWERS) ? { summary: answerSummary(rows) } : null,
      suggestions: isTracked(status, SUGGESTIONS) ? { summary: suggestionSummary(rows) } : null,
      waiting: { answers: missing(status, ANSWERS), suggestions: missing(status, SUGGESTIONS) },
      note: trackingNote(startedInPeriod(status, kr.period, ["sent", "answered", "suggestions"])),
    } satisfies AnswersData,
    asOf: oldest(tracking.fetchedAt, requests.fetchedAt),
  };
}

const pct = (value: number | null) => (value === null ? "–" : formatNumber(value, "percent"));

function View({ data, ctx }: { data: AnswersData; ctx: DashboardContext }) {
  const { period, filters, answers, suggestions, waiting } = data;
  const a = answers?.summary;
  const s = suggestions?.summary;
  const reviewed = s ? s.accepted + s.declined : 0;
  const perRequest: Bar[] = a
    ? [
        { label: "1 answer", title: "1 answer", value: a.perRequest.one },
        { label: "2 answers", title: "2 answers", value: a.perRequest.two },
        { label: "3 or more", title: "3 or more answers", value: a.perRequest.threeOrMore },
      ]
    : [];
  const byRole: Bar[] = a ? a.byRole.map((r) => ({ label: r.label, title: r.label, value: r.count })) : [];

  return (
    <SectionFrame
      sentence={answersSentence({
        days: period.days,
        since: trackedSince(period),
        answers: a ? { requests: a.requests, answered: a.answered, medianToFirst: a.medianToFirst } : null,
        suggestions: s
          ? { made: s.made, withSuggestions: s.withSuggestions, accepted: s.accepted, declined: s.declined }
          : null,
      })}
      notes={data.note ? [data.note] : []}
      howMeasured={
        <>
          <p>
            <strong>Answers</strong> are published replies linked to the request (
            <code>knowledge_request_answered</code>); a request stays open and can collect several. Publishing
            as a standalone fragment, or re-listing one, doesn’t count. If almost every request ends with one
            answer, more answers aren’t adding value yet, so hold off on discussion features; if second
            answers are common, invest in them.
          </p>
          <p>
            <strong>Time to first answer</strong> is the median of the first answer’s{" "}
            <code>seconds_open</code>. <strong>Who answers</strong> counts every answer by{" "}
            <code>answerer_role</code>: a direct assignee (named), a team member (reached through an assigned
            team), or the requester; someone who is both named and in a team counts as a direct assignee.{" "}
            <strong>Role unknown</strong> is an answer from someone who is none of these.
          </p>
          <p>
            <strong>AI suggestions</strong> are answers the AI drafted from existing knowledge (
            <code>system_contribution_created</code>) for a request, which the requester accepts or declines (
            <code>system_contribution_approved</code>, <code>system_contribution_rejected</code>). They carry
            the request id as <code>knowledge_request_id</code>. Each suggested fragment counts once per
            request. If most are declined, raise the matching bar, and reconsider whether a suggestion should
            move a request to In progress, since it can hide requests nobody has really answered.
          </p>
          <RequestsNote />
          <MediansNote />
          <PeriodNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} who="the person who sent each request" />
        </>
      }
    >
      {a && answers ? (
        <>
          <div className="lg:col-span-2">
            <StatTile
              title="Answered"
              value={pct(share(a.answered, a.requests))}
              caption={`${formatNumber(a.answered)} of ${plural(a.requests, "request")}, at least one answer`}
            />
          </div>
          <div className="lg:col-span-2">
            <StatTile
              title="Time to first answer"
              value={a.medianToFirst === null ? "–" : formatDuration(a.medianToFirst)}
              caption={
                a.answered > 0 ? `Median over ${plural(a.answered, "answered request")}` : "No answers yet"
              }
            />
          </div>
          <div className="lg:col-span-2">
            <StatTile
              title="More than one answer"
              value={pct(share(a.perRequest.two + a.perRequest.threeOrMore, a.answered))}
              caption={`Of the answered requests; ${plural(a.answers, "answer")} in all`}
            />
          </div>
          <ChartCard
            className="lg:col-span-3"
            title="Answers per request"
            subtitle={`Answered requests · ${spanLabel(period)}`}
            table={{
              columns: ["Answers", "Requests"],
              rows: perRequest.map((b) => [b.label, b.value ?? 0]),
            }}
          >
            {a.answered === 0 ? (
              <p className="text-body-sm text-text-secondary">No answered requests yet.</p>
            ) : (
              <BarChart
                bars={perRequest}
                seriesLabel="Requests"
                color="var(--color-chart-1)"
                xTickIndices={perRequest.map((_, i) => i)}
                height={200}
                ariaLabel="Answered requests by number of answers"
              />
            )}
          </ChartCard>
          <ChartCard
            className="lg:col-span-3"
            title="Who answers"
            subtitle={`Every answer, ${plural(a.answers, "answer")} in all`}
            table={{ columns: ["Answerer", "Answers"], rows: a.byRole.map((r) => [r.label, r.count]) }}
          >
            {a.answers === 0 ? (
              <p className="text-body-sm text-text-secondary">No answers yet.</p>
            ) : (
              <BarChart
                bars={byRole}
                seriesLabel="Answers"
                color="var(--color-chart-1)"
                xTickIndices={byRole.map((_, i) => i)}
                height={200}
                ariaLabel="Answers by who wrote them"
              />
            )}
          </ChartCard>
        </>
      ) : (
        <WaitingCard className="lg:col-span-6" title="How do requests get answered?" keys={waiting.answers}>
          The share answered, time to the first answer, answers per request and who writes them.
        </WaitingCard>
      )}

      {s && suggestions ? (
        <ShareBar
          className="lg:col-span-6"
          title="Are AI-suggested answers useful?"
          subtitle={[
            `${plural(s.made, "suggestion")} for ${formatNumber(s.withSuggestions)} of ${plural(s.requests, "request")}`,
            reviewed > 0 ? `${pct(share(s.accepted, reviewed))} accepted of those reviewed` : "",
            spanLabel(period),
          ]
            .filter(Boolean)
            .join(" · ")}
          unit="Suggestions"
          segments={[
            { key: "accepted", label: "Accepted", count: s.accepted, color: COLORS.good },
            { key: "declined", label: "Declined", count: s.declined, color: COLORS.attention },
            { key: "notReviewed", label: "Not reviewed", count: s.notReviewed, color: COLORS.pending },
          ]}
        />
      ) : (
        <WaitingCard
          className="lg:col-span-6"
          title="Are AI-suggested answers useful?"
          keys={waiting.suggestions}
        >
          How many AI-suggested answers requesters accept or decline.
        </WaitingCard>
      )}
    </SectionFrame>
  );
}

export const answers: SectionModule<AnswersData> = {
  slug: "answers",
  label: "Answers",
  load,
  View,
};
