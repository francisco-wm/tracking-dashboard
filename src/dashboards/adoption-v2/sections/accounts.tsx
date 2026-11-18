// Named exports: dotted compound access (TableRoot) is not available from a server component.
import {
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@wingmaite/starling-ui";

import { InfoTip } from "@/components/charts/info-tip";
import { formatNumber } from "@/components/charts/scale";
import { SectionFrame } from "@/components/shell/section-frame";
import { ShowNamesSwitch } from "@/components/shell/show-names-switch";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { addDays, formatDayMonth, type ISODate } from "@/lib/dates";
import { hrefWith } from "@/lib/url";

import { ratio, small } from "../chart";
import { HEALTH } from "../config";
import { loadAnswers, loadOrganisations, v2Context } from "../data";
import type { Filters, Period } from "../filters";
import { health, trend, type Health } from "../logic";
import { INFO } from "../info";
import { accountsSentence } from "../sentences";
import { CoreActionNote, SmallNote, WeeksNote, WhoIsCounted } from "./notes";

interface Account {
  id: string;
  name: string;
  seats: number;
  activeLastWeek: number;
  average: number;
  trend: number | null;
  lastActivity: ISODate | null;
  questions: number;
  sourced: number;
  /** Chat messages since citations were tracked, the sourced rate's base. */
  answered: number;
  knowledgeIn: number;
  requests: number;
  health: Health;
}

interface AccountsData {
  period: Period;
  filters: Filters;
  /** Red first, then amber, then green; most seats first within each. */
  accounts: Account[];
}

const ORDER: Record<Health, number> = { red: 0, amber: 1, green: 2 };

async function load(ctx: DashboardContext) {
  const v = v2Context(ctx);
  const [orgs, answers] = await Promise.all([loadOrganisations(ctx, v), loadAnswers(ctx, v)]);
  const from = addDays(v.period.lastWeek, -21);
  const accounts: Account[] = orgs.rows
    .filter((o) => o.seats > 0)
    .map((o) => {
      const mine = answers.rows.filter(
        (a) => a.org === o.id && a.week >= from && a.week <= v.period.lastWeek,
      );
      const account = {
        id: o.id,
        name: o.name,
        seats: o.seats,
        activeLastWeek: o.weeks[3],
        average: o.weeks.reduce((sum, w) => sum + w, 0) / 4,
        trend: trend(o.weeks),
        lastActivity: o.lastActivity,
        questions: o.questions,
        sourced: mine.reduce((sum, a) => sum + a.sourced, 0),
        answered: mine.reduce((sum, a) => sum + a.questions, 0),
        knowledgeIn: o.knowledgeIn,
        requests: o.requests,
      };
      return { ...account, health: health(account, v.today) };
    })
    .sort((a, b) => ORDER[a.health] - ORDER[b.health] || b.seats - a.seats);
  return {
    data: { period: v.period, filters: v.filters, accounts },
    asOf: oldest(orgs.fetchedAt, answers.fetchedAt),
  };
}

const HEALTH_STYLE: Record<Health, string> = {
  red: "text-text-danger",
  amber: "",
  green: "text-text-success",
};

const percent = (value: number) => formatNumber(value, "percent");

function View({ data, ctx }: { data: AccountsData; ctx: DashboardContext }) {
  const { period, filters, accounts } = data;
  const count = (h: Health) => accounts.filter((a) => a.health === h).length;
  const showNames = ctx.searchParams.names === "1";
  const path = `/dashboards/${ctx.dashboard}/accounts`;

  return (
    <SectionFrame
      sentence={accountsSentence({
        total: accounts.length,
        active: accounts.filter((a) => a.activeLastWeek > 0).length,
        red: count("red"),
        amber: count("amber"),
        green: count("green"),
      })}
      howMeasured={
        <>
          <p>
            One row per organisation with at least one seat. <strong>Seats</strong> are approximate: the
            people seen on the organisation’s events, minus anyone who left. <strong>New fragments</strong>{" "}
            are knowledge in, what answers can cite: fragments listed, edits re-listed and files uploaded to
            company knowledge. <strong>Seat activation</strong> is last week’s active people over seats.{" "}
            <strong>Trend</strong> compares last week with the organisation’s own average over the 4 weeks
            ending last week. The 4-week columns cover {formatDayMonth(addDays(period.lastWeek, -21))} to{" "}
            {formatDayMonth(addDays(period.lastWeek, 6))}; the sourced rate only counts chat messages since
            citations were tracked.
          </p>
          <p>
            <strong>Red</strong>: no core action in the last {HEALTH.inactiveDays} days, or seat activation
            below {percent(HEALTH.redSeats)}. <strong>Amber</strong>: seat activation below{" "}
            {percent(HEALTH.amberSeats)}, or last week {percent(-HEALTH.amberTrend)} or more below its 4-week
            average. <strong>Green</strong>: everything else. Thresholds live in <code>config.ts</code>.
          </p>
          <p>Names are hidden unless “Show names” is on; the numbering follows the table’s order.</p>
          <SmallNote />
          <CoreActionNote />
          <WeeksNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-background-light p-5 lg:col-span-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-title-sm font-medium leading-snug">Account health</h3>
            <p className="mt-0.5 text-body-sm text-text-secondary">Red first, then by seats</p>
          </div>
          <div className="flex items-center gap-3">
            <ShowNamesSwitch
              checked={showNames}
              onHref={hrefWith(path, ctx.searchParams, { names: "1" })}
              offHref={hrefWith(path, ctx.searchParams, { names: null })}
            />
            <InfoTip title="Account health" text={INFO.accounts} />
          </div>
        </header>
        {accounts.length === 0 ? (
          <p className="text-body-sm text-text-secondary">No organisation has a seat yet.</p>
        ) : (
          <div className="max-h-[40rem] overflow-auto">
            <TableRoot density="sm">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Organisation</TableHeaderCell>
                  <TableHeaderCell>Health</TableHeaderCell>
                  <TableHeaderCell>Seats</TableHeaderCell>
                  <TableHeaderCell>Active last week</TableHeaderCell>
                  <TableHeaderCell>Seat activation</TableHeaderCell>
                  <TableHeaderCell>Active, 4-week avg</TableHeaderCell>
                  <TableHeaderCell>Trend</TableHeaderCell>
                  <TableHeaderCell>Last activity</TableHeaderCell>
                  <TableHeaderCell>Chat messages, 4 weeks</TableHeaderCell>
                  <TableHeaderCell>Sourced, 4 weeks</TableHeaderCell>
                  <TableHeaderCell>New fragments, 4 weeks</TableHeaderCell>
                  <TableHeaderCell>Requests, 4 weeks</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {/* Names never leave the server unless "Show names" is on: production organisations are customers. */}
                      {showNames && a.name ? a.name : `Organisation ${i + 1}`}
                    </TableCell>
                    <TableCell className={`font-medium capitalize ${HEALTH_STYLE[a.health]}`}>
                      {a.health}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatNumber(a.seats)}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(a.activeLastWeek)}</TableCell>
                    <TableCell className={`tabular-nums ${small(a.seats) ? "text-text-secondary" : ""}`}>
                      {ratio(a.activeLastWeek, a.seats)}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatNumber(a.average, "decimal")}</TableCell>
                    <TableCell className="tabular-nums">
                      {a.trend === null ? "–" : `${a.trend > 0 ? "+" : ""}${percent(a.trend)}`}
                    </TableCell>
                    <TableCell>
                      {a.lastActivity
                        ? `${formatDayMonth(a.lastActivity)} ${a.lastActivity.slice(0, 4)}`
                        : "–"}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatNumber(a.questions)}</TableCell>
                    <TableCell className={`tabular-nums ${small(a.answered) ? "text-text-secondary" : ""}`}>
                      {ratio(a.sourced, a.answered)}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatNumber(a.knowledgeIn)}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(a.requests)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableRoot>
          </div>
        )}
      </section>
    </SectionFrame>
  );
}

export const accountsSection: SectionModule<AccountsData> = {
  slug: "accounts",
  label: "Account health",
  load,
  View,
};
