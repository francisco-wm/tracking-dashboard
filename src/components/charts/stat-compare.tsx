import { formatNumber, type NumberFormat } from "./scale";

/**
 * After vs before, matched by day index: the "before" number covers the same
 * number of days as the after window so far.
 */
export function StatCompare({
  title,
  after,
  beforeMatched,
  beforeFull,
  daysElapsed,
  totalDays,
  format = "int",
}: {
  title: string;
  after: number;
  beforeMatched: number;
  beforeFull: number;
  daysElapsed: number;
  totalDays: number;
  format?: NumberFormat;
}) {
  const delta = after - beforeMatched;
  const complete = daysElapsed >= totalDays;
  const span = daysElapsed === 1 ? "send day" : `days 1–${daysElapsed}`;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-background-light p-5">
      <h3 className="text-title-sm font-medium leading-snug">{title}</h3>
      <div className="flex items-end gap-6">
        <div>
          <p className="text-heading-md font-semibold leading-none">{formatNumber(after, format)}</p>
          <p className="mt-1.5 text-body-sm text-text-secondary">After, {span}</p>
        </div>
        <div>
          <p className="text-title-lg font-medium leading-none text-text-secondary">
            {formatNumber(beforeMatched, format)}
          </p>
          <p className="mt-1.5 text-body-sm text-text-secondary">Before, same days</p>
        </div>
      </div>
      <p className="text-body-sm">
        <Delta value={delta} format={format} />
        {!complete && (
          <span className="text-text-secondary">
            {" "}
            · all {totalDays} days before: {formatNumber(beforeFull, format)}
          </span>
        )}
      </p>
    </section>
  );
}

export function Delta({ value, format = "int" }: { value: number; format?: NumberFormat }) {
  if (value === 0) return <span className="text-text-secondary">No change</span>;
  const up = value > 0;
  return (
    <span className={up ? "text-text-success" : "text-text-danger"}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      {up ? "+" : "−"}
      {formatNumber(Math.abs(value), format)} {up ? "more" : "fewer"}
    </span>
  );
}

export function StatTile({ title, value, caption }: { title: string; value: string; caption?: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border-default bg-background-light p-5">
      <h3 className="text-title-sm font-medium leading-snug">{title}</h3>
      <p className="text-heading-md font-semibold leading-none">{value}</p>
      {caption && <p className="text-body-sm text-text-secondary">{caption}</p>}
    </section>
  );
}
