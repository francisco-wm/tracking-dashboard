import { Funnel } from "@/components/charts/funnel";
import { formatNumber } from "@/components/charts/scale";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

import { DRAFTS_WIDGET, FOLLOW_WINDOW_DAYS, LINK_SECONDS } from "../config";
import {
  hwContext,
  loadClicksByAction,
  loadNewDrafts,
  loadOpenedDrafts,
  loadRequestFollowThrough,
} from "../data";
import { trackedSince, type Filters, type Period } from "../filters";
import { followThroughSentence, plural } from "../sentences";
import { PeriodNote, WhoIsCounted } from "./notes";

interface FollowThroughData {
  period: Period;
  filters: Filters;
  started: { clicks: number; messaged: number; messages: number; listed: number; stillOpen: number };
  opened: { clicks: number; linkedClicks: number; drafts: number; listed: number; stillOpen: number };
  requests: { people: number; answered: number; stillOpen: number };
}

async function load(ctx: DashboardContext) {
  const hw = hwContext(ctx);
  const [started, opened, requests, byAction] = await Promise.all([
    loadNewDrafts(ctx, hw),
    loadOpenedDrafts(ctx, hw),
    loadRequestFollowThrough(ctx, hw),
    loadClicksByAction(ctx, hw),
  ]);
  const openClicks =
    byAction.rows.find((r) => r.widget === DRAFTS_WIDGET && r.action === "open_item")?.clicks ?? 0;
  return {
    data: {
      period: hw.period,
      filters: hw.filters,
      started: {
        clicks: started.clicks,
        messaged: started.messaged,
        messages: started.messages,
        listed: started.listed,
        stillOpen: started.stillOpen,
      },
      opened: {
        clicks: openClicks,
        linkedClicks: opened.linkedClicks,
        drafts: opened.drafts,
        listed: opened.listed,
        stillOpen: opened.stillOpen,
      },
      requests: { people: requests.people, answered: requests.answered, stillOpen: requests.stillOpen },
    },
    asOf: oldest(started.fetchedAt, opened.fetchedAt, requests.fetchedAt, byAction.fetchedAt),
  };
}

/** "2 started in the last 7 days can still be listed", or "" when none can. */
function stillOpen(count: number, rest: string): string {
  return count > 0 ? `${formatNumber(count)} ${rest}` : "";
}

function View({ data, ctx }: { data: FollowThroughData; ctx: DashboardContext }) {
  const { period, filters, started, opened, requests } = data;
  const W = FOLLOW_WINDOW_DAYS;
  const unmatched = Math.max(0, opened.clicks - opened.linkedClicks);

  const startedSubtitle = [
    started.clicks > 0
      ? `Counts drafts, not people · ${plural(started.messages, "message")} sent in them`
      : "",
    stillOpen(started.stillOpen, `started in the last ${W} days can still be listed`),
  ]
    .filter(Boolean)
    .join(" · ");

  const openedSubtitle = [
    opened.drafts > 0 ? `${plural(opened.drafts, "draft")} from ${plural(opened.linkedClicks, "click")}` : "",
    unmatched > 0
      ? `${formatNumber(unmatched)} more ${unmatched === 1 ? "click" : "clicks"} opened no draft page`
      : "",
    stillOpen(opened.stillOpen, `opened in the last ${W} days can still be listed`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SectionFrame
      sentence={followThroughSentence({
        days: period.days,
        since: trackedSince(period),
        opened: { drafts: opened.drafts, listed: opened.listed },
        started: { drafts: started.clicks, listed: started.listed },
      })}
      howMeasured={
        <>
          <p>
            <strong>New drafts</strong> start with a click on “Create draft” in Recent fragment drafts (
            <code>create_fragment_draft</code>); every click creates one draft. Every step counts drafts, not
            people or messages: a draft counts once, however many messages it got.
          </p>
          <p>
            <strong>Got at least one message</strong>: someone sent a message in the draft’s
            knowledge-creation chat (<code>chat_message_sent</code>) within {W} days of the click. That
            includes the chat’s first message, which often has no <code>knowledge_shared</code>. The click and
            the draft are separate events, so the draft is the first one the same person created (
            <code>knowledge_piece_created</code>) within {LINK_SECONDS} seconds of the click. The last step
            counts drafts that got a message <em>and</em> were listed within {W} days, so it never exceeds the
            step before it.
          </p>
          <p>
            <strong>Drafts opened</strong> start with a click on a draft in Recent fragment drafts (
            <code>open_item</code>). The draft is the fragment page the same person viewed within{" "}
            {LINK_SECONDS} seconds (<code>/company-knowledge/fragments/&lt;id&gt;</code>). Each draft counts
            once, however often it was opened, and counts as listed when it was listed or re-listed within {W}{" "}
            days of any of its opens.
          </p>
          <p>
            <strong>Listed</strong> means a new listing (<code>kp_status_changed</code>, draft → published) or
            a re-list (<code>knowledge_piece_republished</code>) of that same fragment.
          </p>
          <p>
            <strong>Requests</strong> are counted per person: people who opened an item in Assigned knowledge
            requests, and whether they published an answer to a request (
            <code>knowledge_request_answered</code>) within {W} days of one of those clicks. Widget clicks
            carry no request id, so the answer can be to any request, not necessarily the one opened.
          </p>
          <p>
            Before the new request tracking, a finished request sent <code>knowledge_request_completed</code>{" "}
            instead. Production still runs that version for now, so either event counts as an answer.
          </p>
          <p>
            <strong>Can still</strong> counts those clicked in the last {W} days that haven’t reached the last
            step yet. They can still count, so recent numbers read low until their {W} days are up.
          </p>
          <PeriodNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="lg:col-span-2">
        <Funnel
          title="New drafts started from the widget"
          subtitle={startedSubtitle || undefined}
          steps={[
            { label: "Drafts started with “Create draft”", count: started.clicks },
            { label: `Got at least one message within ${W} days`, count: started.messaged },
            { label: `Also listed within ${W} days`, count: started.listed },
          ]}
        />
      </div>
      <div className="lg:col-span-2">
        <Funnel
          title="Drafts opened from the widget"
          subtitle={openedSubtitle || undefined}
          steps={[
            { label: "Drafts opened", count: opened.drafts },
            { label: `Listed or re-listed within ${W} days`, count: opened.listed },
          ]}
        />
      </div>
      <div className="lg:col-span-2">
        <Funnel
          title="Requests opened from the widget"
          subtitle={
            stillOpen(
              requests.stillOpen,
              `${requests.stillOpen === 1 ? "person" : "people"} who clicked in the last ${W} days can still answer one`,
            ) || undefined
          }
          steps={[
            { label: "People who opened a request", count: requests.people },
            { label: `Answered a request within ${W} days`, count: requests.answered },
          ]}
        />
      </div>
    </SectionFrame>
  );
}

export const followThrough: SectionModule<FollowThroughData> = {
  slug: "follow-through",
  label: "Follow-through",
  load,
  View,
};
