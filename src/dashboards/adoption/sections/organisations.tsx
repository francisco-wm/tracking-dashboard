// Named exports: dotted compound access (TableRoot) is not available from a server component.
import {
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@wingmaite/starling-ui";

import { ChartCard } from "@/components/charts/chart-card";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { ShowNamesSwitch } from "@/components/shell/show-names-switch";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { addDays, formatDayMonth } from "@/lib/dates";
import { hrefWith } from "@/lib/url";

import { COLORS, weeklyChart, weeklyTable } from "../chart-props";
import { adContext, loadOrganisations, loadWeeklyEvents, type OrgRow } from "../data";
import { weekIndex, type Filters, type Period } from "../filters";
import { changePhrase, orgsSentence } from "../sentences";
import { ActiveNote, WeeksNote, WhoIsCounted } from "./notes";

interface OrganisationsData {
  period: Period;
  filters: Filters;
  /** Organisations with at least one active person, per week. */
  weekly: number[];
  /** Most active last week first. */
  rows: OrgRow[];
}

async function load(ctx: DashboardContext) {
  const ad = adContext(ctx);
  const [events, orgs] = await Promise.all([loadWeeklyEvents(ctx, ad), loadOrganisations(ctx, ad)]);
  return {
    data: {
      period: ad.period,
      filters: ad.filters,
      weekly: events.weeks.map((w) => w.orgs),
      rows: orgs.rows,
    },
    asOf: oldest(events.fetchedAt, orgs.fetchedAt),
  };
}

/** "4 May 2026", with the year: first activity can go back to 2025. */
const longDate = (iso: string) => `${formatDayMonth(iso)} ${iso.slice(0, 4)}`;

function View({ data, ctx }: { data: OrganisationsData; ctx: DashboardContext }) {
  const { period, filters, weekly, rows } = data;
  const last = weekIndex(period, period.lastWeek);
  const lastWeek = weekly[last];
  const fourWeeksBefore = weekly[weekIndex(period, addDays(period.lastWeek, -28))] ?? 0;
  const newOrgs = rows.filter((r) => r.firstActive >= period.start).length;

  const showNames = ctx.searchParams.names === "1";
  const path = `/dashboards/${ctx.dashboard}/organisations`;
  // Names never leave the server unless "Show names" is on: production organisations are customers.
  const table = rows.map((row, i) => ({
    ...row,
    label: showNames && row.slug ? row.slug : `Organisation ${i + 1}`,
  }));

  const series: LineSeries[] = [
    { key: "orgs", label: "Active organisations", color: COLORS.one, values: weekly },
  ];

  return (
    <SectionFrame
      sentence={orgsSentence({
        week: period.lastWeek,
        active: lastWeek,
        total: rows.length,
        newOrgs,
        weeks: period.weeks,
      })}
      howMeasured={
        <>
          <p>
            An <strong>active organisation</strong> had at least one active person in it that week. The
            organisation comes from the page’s path, so someone active in two organisations counts in both.{" "}
            <strong>New</strong> organisations had their first active person ever in the last {period.weeks}{" "}
            weeks.
          </p>
          <p>
            The table lists every organisation active in the last {period.weeks} weeks, most active last week
            first. Names are hidden unless “Show names” is on; the numbering follows the table’s order.
          </p>
          <ActiveNote />
          <WeeksNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="grid gap-4 lg:col-span-6 lg:grid-cols-3">
        <StatTile
          title="Active organisations last week"
          value={formatNumber(lastWeek)}
          caption={`Week of ${formatDayMonth(period.lastWeek)} · ${changePhrase(lastWeek, fourWeeksBefore)}`}
        />
        <StatTile
          title={`Active in the last ${period.weeks} weeks`}
          value={formatNumber(rows.length)}
          caption="At least one active person in at least one week"
        />
        <StatTile
          title="New organisations"
          value={formatNumber(newOrgs)}
          caption={`First active person in the last ${period.weeks} weeks`}
        />
      </div>
      <ChartCard
        className="lg:col-span-6"
        title="Weekly active organisations"
        subtitle="Organisations with at least one active person that week"
        table={weeklyTable(period, series)}
      >
        <LineChart {...weeklyChart(period, series, "Active organisations per week")} />
      </ChartCard>
      <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-background-light p-5 lg:col-span-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-title-sm font-medium leading-snug">Each organisation</h3>
            <p className="mt-0.5 text-body-sm text-text-secondary">
              Active in the last {period.weeks} weeks, most active last week first
            </p>
          </div>
          <ShowNamesSwitch
            checked={showNames}
            onHref={hrefWith(path, ctx.searchParams, { names: "1" })}
            offHref={hrefWith(path, ctx.searchParams, { names: null })}
          />
        </header>
        {table.length === 0 ? (
          <p className="text-body-sm text-text-secondary">No organisation was active in this period.</p>
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <TableRoot density="sm">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Organisation</TableHeaderCell>
                  <TableHeaderCell>Active people last week</TableHeaderCell>
                  <TableHeaderCell>Active people, {period.weeks} weeks</TableHeaderCell>
                  <TableHeaderCell>Weeks active</TableHeaderCell>
                  <TableHeaderCell>First active</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.map((org, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span className="font-medium">{org.label}</span>
                      {org.firstActive >= period.start && (
                        <span className="ml-2 text-label-xs text-text-secondary">new</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatNumber(org.peopleLastWeek)}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(org.people)}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatNumber(org.weeks)} of {period.weeks}
                    </TableCell>
                    <TableCell>{longDate(org.firstActive)}</TableCell>
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

export const organisationsSection: SectionModule<OrganisationsData> = {
  slug: "organisations",
  label: "Organisations",
  load,
  View,
};
