"use client";

export interface TooltipRow {
  key: string;
  label: string;
  color: string;
  value: string;
  /** "line" for line series, "rect" for bars/areas. */
  keyShape?: "line" | "rect";
}

const TOOLTIP_WIDTH = 200;

/** One tooltip listing every series at the hovered position. Text, never HTML. */
export function ChartTooltip({
  x,
  y,
  containerWidth,
  title,
  rows,
}: {
  x: number;
  y: number;
  containerWidth: number;
  title: string;
  rows: TooltipRow[];
}) {
  const flip = x + 16 + TOOLTIP_WIDTH > containerWidth;
  const left = flip ? Math.max(0, x - 16 - TOOLTIP_WIDTH) : x + 16;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 w-[200px] rounded-md border border-border-default bg-background-light px-3 py-2 shadow-sm"
      style={{ left, top: y }}
    >
      <p className="mb-1.5 text-[12px] text-text-secondary">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-[12px] leading-tight">
            {row.keyShape === "rect" ? (
              <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: row.color }} />
            ) : (
              <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: row.color }} />
            )}
            <span className="font-semibold tabular-nums text-text-primary">{row.value}</span>
            <span className="truncate text-text-secondary">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
