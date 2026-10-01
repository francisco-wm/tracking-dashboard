"use client";

import { useState } from "react";

import { ChartTooltip } from "./chart-tooltip";
import { formatNumber, linearScale, niceTicks, type NumberFormat } from "./scale";
import { useMeasuredWidth } from "./use-measured-width";

export interface Bar {
  label: string;
  title: string;
  /** null = this day hasn't happened yet: an empty slot. */
  value: number | null;
}

export interface BarChartProps {
  bars: Bar[];
  seriesLabel: string;
  color: string;
  xTickIndices: number[];
  format?: NumberFormat;
  height?: number;
  ariaLabel: string;
}

const MARGIN = { top: 18, right: 8, bottom: 26, left: 40 };
const MAX_BAR = 24;
const RADIUS = 4;

/** Single-series columns: rounded data-end, square at the baseline, hover per bar. */
export function BarChart({
  bars,
  seriesLabel,
  color,
  xTickIndices,
  format = "int",
  height = 220,
  ariaLabel,
}: BarChartProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const values = bars.map((b) => b.value ?? 0);
  const ticks = niceTicks(0, Math.max(0, ...values), 4, format === "int");
  const y = linearScale([ticks.min, ticks.max], [MARGIN.top + plotH, MARGIN.top]);
  const band = bars.length ? plotW / bars.length : 0;
  const barW = Math.min(MAX_BAR, Math.max(2, band - 2));
  const center = (i: number) => MARGIN.left + band * i + band / 2;
  const maxIndex = values.indexOf(Math.max(...values));

  return (
    <div ref={ref} className="relative w-full" style={{ height }} role="group" aria-label={ariaLabel}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
          {ticks.values.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + plotW}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-chart-grid)"
              />
              <text
                x={MARGIN.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-text-secondary text-[11px] tabular-nums"
              >
                {formatNumber(tick, format)}
              </text>
            </g>
          ))}
          {xTickIndices.map((i) => (
            <text
              key={i}
              x={center(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-text-secondary text-[11px]"
            >
              {bars[i].label}
            </text>
          ))}
          {bars.map((bar, i) => {
            if (bar.value === null || bar.value === 0) return null;
            const top = y(bar.value);
            const base = y(0);
            return (
              <path
                key={i}
                d={roundedTopBar(center(i) - barW / 2, top, barW, base - top)}
                fill={color}
                opacity={active === null || active === i ? 1 : 0.55}
              />
            );
          })}
          {maxIndex >= 0 && values[maxIndex] > 0 && (
            <text
              x={center(maxIndex)}
              y={y(values[maxIndex]) - 6}
              textAnchor="middle"
              className="fill-text-primary text-[12px] font-medium tabular-nums"
            >
              {formatNumber(values[maxIndex], format)}
            </text>
          )}
          {/* hit targets: the full band, bigger than the mark */}
          {bars.map((_, i) => (
            <rect
              key={i}
              x={MARGIN.left + band * i}
              y={MARGIN.top}
              width={band}
              height={plotH}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>
      )}
      {active !== null && (
        <ChartTooltip
          x={center(active)}
          y={MARGIN.top}
          containerWidth={width}
          title={bars[active].title}
          rows={[
            {
              key: "value",
              label: seriesLabel,
              color,
              keyShape: "rect",
              value: bars[active].value === null ? "Not yet" : formatNumber(bars[active].value!, format),
            },
          ]}
        />
      )}
    </div>
  );
}

/** A column with 4px rounded top corners and a square base. */
export function roundedTopBar(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** The mirror for negative values: rounded bottom corners, square at the baseline. */
export function roundedBottomBar(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
}
