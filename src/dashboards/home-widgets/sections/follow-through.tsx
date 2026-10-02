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
import type { Filters, Period } from "../filters";
import { followThroughSentence, plural } from "../sentences";
import { PeriodNote, WhoIsCounted } from "./notes";

interface FollowThroughData {
  period: Period;
  filters: Filters;
  started: { clicks: number; created: number; messaged: number; listed: number; stillOpen: number };
  opened: { clicks: number; linkedClicks: number; drafts: number; listed: number; stillOpen: number };
  requests: { people: number; completed: number; stillOpen: number };
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
        created: started.created,
        messaged: started.messaged,
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
      requests: { people: requests.people, completed: requests.completed, stillOpen: requests.stillOpen },
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
        opened: { drafts: opened.drafts, listed: opened.listed },
        started: { drafts: started.clicks, listed: started.listed },
      })}
      howMeasured={
        <>
          <p>
            <strong>New drafts</strong> start with a click on “Create draft” in Recent fragment drafts (
            <code>create_fragment_draft</code>). The draft it made is the first one the same person created (
            <code>knowledge_piece_created</code>) within {LINK_SECONDS} seconds of the click. A message counts
            when it was sent in that draft’s chat (<code>chat_message_sent</code>, knowledge creation) within{" "}
            {W} days. That includes the chat’s first message, which often has no <code>knowledge_shared</code>
            . The last step counts drafts that got a message <em>and</em> were listed within {W} days, so it
            never exceeds the step before it.
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
            requests, and whether they completed a request (<code>knowledge_request_completed</code>) within{" "}
            {W} days of one of those clicks. Completions carry no request id, so this can’t tell which request
            was completed.
          </p>
          <p>
            <strong>Can still</strong> counts those clicked in the last {W} days that haven’t reached the last
            step yet. They can still count, so recent numbers read low until their {W} days are up.
          </p>
          <PeriodNote days={period.days} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="lg:col-span-2">
        <Funnel
          title="New drafts started from the widget"
          subtitle={
            stillOpen(started.stillOpen, `started in the last ${W} days can still be listed`) || undefined
          }
          steps={[
            { label: "Clicked “Create draft”", count: started.clicks },
            { label: "Draft created", count: started.created },
            { label: `Sent a message within ${W} days`, count: started.messaged },
            { label: "Also listed within that time", count: started.listed },
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
              `${requests.stillOpen === 1 ? "person" : "people"} who clicked in the last ${W} days can still complete one`,
            ) || undefined
          }
          steps={[
            { label: "People who opened a request", count: requests.people },
            { label: `Completed a request within ${W} days`, count: requests.completed },
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
