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
import { Funnel } from "@/components/charts/funnel";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { addDays, formatDayMonth, type ISODate } from "@/lib/dates";

import { ratio, small } from "../chart";
import { ACTIVATION_DAYS, FUNNEL_WEEKS, INVITE_DAYS, RETURN_FROM_DAY, RETURN_TO_DAY } from "../config";
import { citationsDay, loadInvites, loadRegistrations, v2Context } from "../data";
import type { Filters, Period } from "../filters";
import { funnel, type ActivationWindow, type Registration, type Stage } from "../logic";
import { INFO } from "../info";
import { activationSentence } from "../sentences";
import { CoreActionNote, SmallNote, SourcedNote, WhoIsCounted } from "./notes";

interface ActivationData {
  period: Period;
  filters: Filters;
  since: ISODate;
  window: ActivationWindow;
  registrations: Registration[];
  invites: { from: ISODate; to: ISODate; sent: number; accepted: number };
}

async function load(ctx: DashboardContext) {
  const v = v2Context(ctx);
  const [regs, invites] = await Promise.all([loadRegistrations(ctx, v), loadInvites(ctx, v)]);
  return {
    data: {
      period: v.period,
      filters: v.filters,
      since: citationsDay(v),
      window: regs.window,
      registrations: regs.registrations,
      invites,
    },
    asOf: oldest(regs.fetchedAt, invites.fetchedAt),
  };
}

const longDate = (iso: ISODate) => `${formatDayMonth(iso)} ${iso.slice(0, 4)}`;
const days = (value: number | null) => (value === null ? "–" : formatNumber(value, "decimal"));

function StageTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | { text: string; muted: boolean })[][];
}) {
  return (
    <TableRoot density="sm">
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHeaderCell key={c}>{c}</TableHeaderCell>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) =>
              typeof cell === "string" ? (
                <TableCell key={j} className={j > 0 ? "tabular-nums" : ""}>
                  {cell}
                </TableCell>
              ) : (
                <TableCell key={j} className={`tabular-nums ${cell.muted ? "text-text-secondary" : ""}`}>
                  {cell.text}
                </TableCell>
              ),
            )}
          </TableRow>
        ))}
      </TableBody>
    </TableRoot>
  );
}

/** "3 · 60% · 3/5" style cells: the count, then its share of the step before. */
function stageCells(stages: Stage[]) {
  return stages.map((s, i) =>
    i === 0
      ? formatNumber(s.people)
      : { text: ratio(s.people, stages[i - 1].people), muted: small(stages[i - 1].people) },
  );
}

function View({ data, ctx }: { data: ActivationData; ctx: DashboardContext }) {
  const { filters, since, window, registrations, invites } = data;
  const stages = funnel(registrations);
  const invited = funnel(registrations.filter((r) => r.invited));
  const selfRegistered = funnel(registrations.filter((r) => !r.invited));
  const last = addDays(window.to, -1);

  return (
    <SectionFrame
      sentence={activationSentence({
        ready: window.ready,
        firstReady: window.firstReady,
        citationsDay: since,
        stages,
      })}
      howMeasured={
        <>
          <p>
            The funnel follows people who registered (<code>user_created</code>) in the {FUNNEL_WEEKS} weeks
            before their first 28 days could be over, but not before citations were tracked: the aha moment
            needs them. Registration day is day 1. Each step requires the ones above it:{" "}
            <strong>first core action</strong> and <strong>first sourced answer</strong> on day 1 to{" "}
            {ACTIVATION_DAYS}, and <strong>active again</strong> with a core action on day {RETURN_FROM_DAY}{" "}
            to {RETURN_TO_DAY}. Median days run from the moment they registered.
          </p>
          <p>
            <strong>Invited</strong> people accepted an invite (<code>invitation_accepted</code>); the rest
            registered themselves. <strong>Invite acceptance</strong> counts invites sent at least{" "}
            {INVITE_DAYS} days ago, accepted within {INVITE_DAYS} days.
          </p>
          <SourcedNote since={since} />
          <CoreActionNote />
          <SmallNote />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-3">
        <StatTile
          title="Invite acceptance"
          info={INFO.invites}
          value={ratio(invites.accepted, invites.sent)}
          caption={`Invites sent ${formatDayMonth(invites.from)} – ${formatDayMonth(invites.to)}, accepted within ${INVITE_DAYS} days`}
        />
        <StatTile
          title="People followed"
          info={INFO.followed}
          value={formatNumber(registrations.length)}
          caption={
            window.ready
              ? `Registered ${formatDayMonth(window.from.slice(0, 10))} – ${formatDayMonth(last)}`
              : `From ${longDate(window.firstReady)}`
          }
        />
      </div>
      {window.ready && (
        <>
          <div className="lg:col-span-3">
            <Funnel
              title="Activation funnel"
              info={INFO.funnel}
              subtitle={`Registered ${formatDayMonth(window.from.slice(0, 10))} – ${formatDayMonth(last)}; share of everyone registered`}
              steps={stages.map((s) => ({ label: s.label, count: s.people }))}
            />
          </div>
          <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-background-light p-5 lg:col-span-3">
            <header className="flex items-start justify-between gap-2">
              <h3 className="text-title-sm font-medium leading-snug">Each step</h3>
              <InfoTip title="Each step" text={INFO.steps} />
            </header>
            <StageTable
              columns={["Step", "People", "Of the step before", "Median days"]}
              rows={stages.map((s, i) => [
                s.label,
                formatNumber(s.people),
                i === 0
                  ? "–"
                  : { text: ratio(s.people, stages[i - 1].people), muted: small(stages[i - 1].people) },
                days(s.medianDays),
              ])}
            />
            <h3 className="mt-2 text-title-sm font-medium leading-snug">By how they registered</h3>
            <StageTable
              columns={["Step", "Invited", "Self-registered"]}
              rows={stages.map((s, i) => [s.label, stageCells(invited)[i], stageCells(selfRegistered)[i]])}
            />
          </section>
        </>
      )}
    </SectionFrame>
  );
}

export const activationSection: SectionModule<ActivationData> = {
  slug: "activation",
  label: "Activation",
  load,
  View,
};
