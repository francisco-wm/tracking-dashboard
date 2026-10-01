// Named exports: dotted compound access (TableRoot) is not available from a server component.
import {
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@wingmaite/starling-ui";

import { Funnel } from "@/components/charts/funnel";
import { NoSendYet, SectionFrame } from "@/components/shell/section-frame";
import { ShowNamesSwitch } from "@/components/shell/show-names-switch";
import type { DashboardContext, SectionModule } from "@/dashboards/types";
import { formatDayMonth } from "@/lib/dates";
import { hrefWith } from "@/lib/url";

import { kcContext, loadClickers, type BeforeAfter, type ClickerRow, type KCContext } from "../data";
import { clickersSentence } from "../sentences";
import { EveryoneCounted } from "./notes";

const DAY_MS = 86_400_000;

interface ClickersData {
  kc: KCContext;
  rows: (ClickerRow & { afterInProgress: boolean })[];
}

async function load(ctx: DashboardContext) {
  const kc = kcContext(ctx);
  if (!kc) return { data: null, asOf: new Date().toISOString() };
  const clickers = await loadClickers(ctx, kc);
  const now = Date.now();
  const rows = clickers.rows.map((row) => ({
    ...row,
    // Clicked less than 7 days ago: the "after" numbers are still growing.
    afterInProgress: now - Date.parse(row.firstClick) < 7 * DAY_MS,
  }));
  return { data: { kc, rows }, asOf: clickers.fetchedAt };
}

function Change({ value }: { value: BeforeAfter }) {
  return (
    <span className="tabular-nums whitespace-nowrap">
      <span className="text-text-secondary">{value.before}</span>
      <span aria-hidden="true" className="text-text-secondary">
        {" "}
        →{" "}
      </span>
      <span className="sr-only"> before, </span>
      <span className="font-medium">{value.after}</span>
      <span className="sr-only"> after</span>
    </span>
  );
}

function Flag({ on }: { on: boolean }) {
  return on ? (
    <span className="text-text-success">Yes</span>
  ) : (
    <span className="text-text-secondary">No</span>
  );
}

function View({ data, ctx }: { data: ClickersData | null; ctx: DashboardContext }) {
  if (!data) return <NoSendYet />;
  const { rows } = data;
  const showNames = ctx.searchParams.names === "1";
  const path = `/dashboards/${ctx.dashboard}/clickers`;
  // Names never leave the server unless "Show names" is on: production rows are customer users.
  const people = rows.map((row, i) => ({
    label: showNames && row.name ? row.name : `Clicker ${i + 1}`,
    firstClick: row.firstClick,
    questions: row.questions,
    contributions: row.contributions,
    listings: row.listings,
    relists: row.relists,
    actedWithin24h: row.actedWithin24h,
    contributedWithin7d: row.contributedWithin7d,
    listedWithin7d: row.listedWithin7d,
    afterInProgress: row.afterInProgress,
  }));

  const acted = rows.filter((r) => r.actedWithin24h).length;
  const contributed = rows.filter((r) => r.contributedWithin7d).length;
  // Both, in any order, so the last funnel step can never exceed the one before it.
  const listed = rows.filter((r) => r.contributedWithin7d && r.listedWithin7d).length;

  return (
    <SectionFrame
      sentence={clickersSentence({
        clickers: rows.length,
        actedWithin24h: acted,
        contributedWithin7d: contributed,
      })}
      howMeasured={
        <>
          <p>
            <strong>Clickers</strong> are people who clicked “Share your knowledge” in the email since the
            send. Everything is measured from each person’s first click.
          </p>
          <p>
            <strong>Asked or contributed within 24 hours:</strong> a message in a regular chat or in a
            knowledge-creation chat in the 24 hours after the click.{" "}
            <strong>Contributed within 7 days:</strong> a message in a knowledge-creation chat in the 7 days
            after the click. <strong>Listed within 7 days:</strong> a new listing (draft to published) or a
            re-list in the 7 days after the click, before or after the contribution. People often publish
            before their first contribution is recorded, so the order isn’t required. The funnel’s last step
            counts people who did both.
          </p>
          <p>
            The table compares each clicker’s 7 days before their first click with the 7 days after. Rows
            marked “so far” clicked less than 7 days ago, so their after numbers are still growing.
          </p>
          <EveryoneCounted />
        </>
      }
    >
      <div className="lg:col-span-3">
        <Funnel
          title="Did clickers act within 24 hours?"
          steps={[
            { label: "Clicked “Share your knowledge”", count: rows.length },
            { label: "Asked a question or contributed within 24 hours", count: acted },
          ]}
        />
      </div>
      <div className="lg:col-span-3">
        <Funnel
          title="Did clickers contribute and list within 7 days?"
          steps={[
            { label: "Clicked “Share your knowledge”", count: rows.length },
            { label: "Contributed within 7 days", count: contributed },
            { label: "Also listed or re-listed knowledge", count: listed },
          ]}
        />
      </div>
      <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-background-light p-5 lg:col-span-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-title-sm font-medium leading-snug">
              Each clicker, 7 days before → 7 days after
            </h3>
            <p className="mt-0.5 text-body-sm text-text-secondary">
              From their first click, oldest click first
            </p>
          </div>
          <ShowNamesSwitch
            checked={showNames}
            onHref={hrefWith(path, ctx.searchParams, { names: "1" })}
            offHref={hrefWith(path, ctx.searchParams, { names: null })}
          />
        </header>
        {people.length === 0 ? (
          <p className="text-body-sm text-text-secondary">Nobody has clicked yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <TableRoot density="sm">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Clicker</TableHeaderCell>
                  <TableHeaderCell>First click</TableHeaderCell>
                  <TableHeaderCell>Questions</TableHeaderCell>
                  <TableHeaderCell>Contributions</TableHeaderCell>
                  <TableHeaderCell>New listings</TableHeaderCell>
                  <TableHeaderCell>Re-lists</TableHeaderCell>
                  <TableHeaderCell>Acted in 24h</TableHeaderCell>
                  <TableHeaderCell>Contributed in 7d</TableHeaderCell>
                  <TableHeaderCell>Listed in 7d</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span className="font-medium">{p.label}</span>
                      {p.afterInProgress && (
                        <span className="ml-2 text-label-xs text-text-secondary">so far</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDayMonth(p.firstClick.slice(0, 10))}, {p.firstClick.slice(11, 16)} UTC
                    </TableCell>
                    <TableCell>
                      <Change value={p.questions} />
                    </TableCell>
                    <TableCell>
                      <Change value={p.contributions} />
                    </TableCell>
                    <TableCell>
                      <Change value={p.listings} />
                    </TableCell>
                    <TableCell>
                      <Change value={p.relists} />
                    </TableCell>
                    <TableCell>
                      <Flag on={p.actedWithin24h} />
                    </TableCell>
                    <TableCell>
                      <Flag on={p.contributedWithin7d} />
                    </TableCell>
                    <TableCell>
                      <Flag on={p.listedWithin7d} />
                    </TableCell>
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

export const clickers: SectionModule<ClickersData | null> = {
  slug: "clickers",
  label: "Clickers",
  load,
  View,
};
