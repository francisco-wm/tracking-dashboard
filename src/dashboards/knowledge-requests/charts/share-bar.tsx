"use client";

import { useState } from "react";

import { ChartCard } from "@/components/charts/chart-card";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { formatNumber } from "@/components/charts/scale";
import { useMeasuredWidth } from "@/components/charts/use-measured-width";

export interface ShareSegment {
  key: string;
  label: string;
  count: number;
  /** A chart colour token, e.g. "var(--color-chart-1)". */
  color: string;
}

const pct = (part: number, total: number) => formatNumber(total > 0 ? part / total : 0, "percent");

/**
 * Part-to-whole as one horizontal stacked bar: 2px surface gaps between
 * segments, a legend with every count, a hover tooltip per segment, and a
 * table view. Empty segments stay in the legend and table, so a zero reads as
 * "none" instead of disappearing.
 */
export function ShareBar({
  title,
  subtitle,
  segments,
  unit,
  className,
}: {
  title: string;
  subtitle?: string;
  segments: ShareSegment[];
  /** What is counted, e.g. "Requests"; heads the table's count column. */
  unit: string;
  className?: string;
}) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const drawn = segments.map((s, i) => ({ ...s, i })).filter((s) => s.count > 0);

  // Each drawn segment's centre, for placing the tooltip.
  let before = 0;
  const centres = new Map<number, number>();
  for (const s of drawn) {
    centres.set(s.i, ((before + s.count / 2) / total) * width);
    before += s.count;
  }
  const current = active === null ? null : segments[active];

  return (
    <ChartCard
      className={className}
      title={title}
      subtitle={subtitle}
      legend={
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-secondary">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
              {s.label}
              <span className="font-semibold tabular-nums text-text-primary">{formatNumber(s.count)}</span>
            </li>
          ))}
        </ul>
      }
      table={{
        columns: ["", unit, "Share"],
        rows: segments.map((s) => [s.label, s.count, pct(s.count, total)]),
      }}
    >
      {total === 0 ? (
        <p className="text-body-sm text-text-secondary">Nothing to show for this period.</p>
      ) : (
        <div
          ref={ref}
          className="relative"
          role="img"
          aria-label={`${title}: ${segments.map((s) => `${s.label} ${s.count} of ${total}`).join(", ")}`}
        >
          <div className="flex h-6 w-full gap-0.5" onPointerLeave={() => setActive(null)}>
            {drawn.map((s, j) => (
              <div
                key={s.key}
                className={`h-full min-w-0.5 ${j === 0 ? "rounded-l-[4px]" : ""} ${j === drawn.length - 1 ? "rounded-r-[4px]" : ""}`}
                style={{
                  flex: `${s.count} 1 0%`,
                  background: s.color,
                  opacity: active === null || active === s.i ? 1 : 0.55,
                }}
                onPointerEnter={() => setActive(s.i)}
              />
            ))}
          </div>
          {current && active !== null && (
            <ChartTooltip
              x={centres.get(active) ?? 0}
              y={32}
              containerWidth={width}
              title={current.label}
              rows={[
                {
                  key: current.key,
                  label: `of ${formatNumber(total)}`,
                  color: current.color,
                  keyShape: "rect",
                  value: `${formatNumber(current.count)} · ${pct(current.count, total)}`,
                },
              ]}
            />
          )}
        </div>
      )}
    </ChartCard>
  );
}
