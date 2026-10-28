import { ChartCard } from "@/components/charts/chart-card";

export interface BarItem {
  key: string;
  label: string;
  /** Bar length as a share of the longest possible bar, 0–1. */
  share: number;
  /** The value printed at the bar's tip, e.g. "4" or "70% of 20". */
  display: string;
}

/**
 * Horizontal bars for a small breakdown, one series in one colour, each
 * labelled at its tip, with a table view. Same marks as the shared Funnel.
 */
export function BarList({
  title,
  subtitle,
  items,
  table,
  empty,
  className,
}: {
  title: string;
  subtitle?: string;
  items: BarItem[];
  table: { columns: string[]; rows: (string | number)[][] };
  empty: string;
  className?: string;
}) {
  return (
    <ChartCard className={className} title={title} subtitle={subtitle} table={table}>
      {items.length === 0 ? (
        <p className="text-body-sm text-text-secondary">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-body-sm">
                <span>{item.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">{item.display}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-chart-grid">
                {item.share > 0 && (
                  <div
                    className="h-2.5 rounded-full bg-chart-1"
                    style={{ width: `${Math.max(2, Math.min(1, item.share) * 100)}%` }}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
