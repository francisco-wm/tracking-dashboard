"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";

import { ChartTooltip, type TooltipRow } from "./chart-tooltip";
import { formatNumber, linearScale, niceTicks, type NumberFormat } from "./scale";
import { useMeasuredWidth } from "./use-measured-width";

export interface LineSeries {
  key: string;
  label: string;
  /** A chart colour token, e.g. "var(--color-chart-after)". */
  color: string;
  /** null = no data (yet); the line stops there. */
  values: (number | null)[];
}

export interface ChartMarker {
  index: number;
  label: string;
}

export interface LineChartProps {
  series: LineSeries[];
  /** Axis label per index. */
  xLabels: string[];
  /** Tooltip heading per index. */
  titles: string[];
  xTickIndices: number[];
  markers?: ChartMarker[];
  /** A point that is still in progress (current week): drawn lighter. */
  partialIndex?: number;
  format?: NumberFormat;
  height?: number;
  ariaLabel: string;
}

const MARGIN = { top: 22, right: 56, bottom: 26, left: 40 };
const LABEL_GAP = 15;

export function LineChart({
  series,
  xLabels,
  titles,
  xTickIndices,
  markers = [],
  partialIndex,
  format = "int",
  height = 240,
  ariaLabel,
}: LineChartProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const count = xLabels.length;
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const ticks = niceTicks(0, Math.max(0, ...all), 4, format === "int");
  const x = (i: number) => MARGIN.left + (count > 1 ? (i / (count - 1)) * plotW : plotW / 2);
  const y = linearScale([ticks.min, ticks.max], [MARGIN.top + plotH, MARGIN.top]);

  function indexAt(clientX: number, rect: DOMRect) {
    const step = count > 1 ? plotW / (count - 1) : plotW;
    const i = Math.round((clientX - rect.left - MARGIN.left) / step);
    return Math.min(count - 1, Math.max(0, i));
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    setActive(indexAt(event.clientX, event.currentTarget.getBoundingClientRect()));
  }

  // Keyboard focus only: after a mouse click the arrows keep switching sections.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (!event.currentTarget.matches(":focus-visible")) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.key === "ArrowLeft" ? -1 : 1;
    setActive((i) => Math.min(count - 1, Math.max(0, (i ?? count - 1) + delta)));
  }

  const endLabels = placeEndLabels(series, x, y, format, partialIndex);

  const tooltipRows: TooltipRow[] =
    active === null
      ? []
      : series.map((s) => ({
          key: s.key,
          label: s.label,
          color: s.color,
          value: s.values[active] === null ? "Not yet" : formatNumber(s.values[active]!, format),
        }));

  return (
    <div
      ref={ref}
      className="relative w-full outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded-md"
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      data-chart
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) setActive((i) => i ?? count - 1);
      }}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block overflow-visible"
          aria-hidden="true"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
        >
          {/* gridlines + y ticks */}
          {ticks.values.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + plotW}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-chart-grid)"
                strokeWidth={1}
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

          {/* x ticks */}
          {xTickIndices.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 8}
              textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}
              className="fill-text-secondary text-[11px]"
            >
              {xLabels[i]}
            </text>
          ))}

          {/* send markers */}
          {markers.map((marker) => (
            <g key={`${marker.index}-${marker.label}`}>
              <line
                x1={x(marker.index)}
                x2={x(marker.index)}
                y1={MARGIN.top - 4}
                y2={MARGIN.top + plotH}
                stroke="var(--color-chart-marker)"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <text
                x={x(marker.index)}
                y={MARGIN.top - 9}
                textAnchor={marker.index > count * 0.8 ? "end" : "middle"}
                className="fill-text-secondary text-[11px]"
              >
                {marker.label}
              </text>
            </g>
          ))}

          {/* lines */}
          {series.map((s) => (
            <SeriesPath key={s.key} series={s} x={x} y={y} partialIndex={partialIndex} />
          ))}

          {/* end labels with leader lines when nudged */}
          {endLabels.map((label) => (
            <g key={label.key}>
              {Math.abs(label.labelY - label.pointY) > 2 && (
                <line
                  x1={label.pointX + 5}
                  x2={label.pointX + 9}
                  y1={label.pointY}
                  y2={label.labelY}
                  stroke="var(--color-text-secondary)"
                  strokeWidth={1}
                />
              )}
              <circle
                cx={label.pointX}
                cy={label.pointY}
                r={4}
                fill={label.color}
                stroke="var(--color-surface-card)"
                strokeWidth={2}
                opacity={label.partial ? 0.5 : 1}
              />
              <text
                x={label.pointX + 10}
                y={label.labelY}
                dy="0.32em"
                className="fill-text-primary text-[12px] font-medium tabular-nums"
              >
                {label.text}
              </text>
            </g>
          ))}

          {/* crosshair */}
          {active !== null && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={MARGIN.top}
                y2={MARGIN.top + plotH}
                stroke="var(--color-text-secondary)"
                strokeWidth={1}
              />
              {series.map((s) =>
                s.values[active] === null ? null : (
                  <circle
                    key={s.key}
                    cx={x(active)}
                    cy={y(s.values[active]!)}
                    r={4}
                    fill={s.color}
                    stroke="var(--color-surface-card)"
                    strokeWidth={2}
                  />
                ),
              )}
            </g>
          )}

          {/* hit area: the whole plot, so the pointer only needs the right x */}
          <rect x={MARGIN.left - 8} y={MARGIN.top} width={plotW + 16} height={plotH} fill="transparent" />
        </svg>
      )}

      {active !== null && (
        <ChartTooltip
          x={x(active)}
          y={MARGIN.top}
          containerWidth={width}
          title={titles[active]}
          rows={tooltipRows}
        />
      )}
    </div>
  );
}

function SeriesPath({
  series,
  x,
  y,
  partialIndex,
}: {
  series: LineSeries;
  x: (i: number) => number;
  y: (v: number) => number;
  partialIndex?: number;
}) {
  const solid: string[] = [];
  let partial = "";
  let pen = false;
  series.values.forEach((value, i) => {
    if (value === null) {
      pen = false;
      return;
    }
    if (partialIndex !== undefined && i === partialIndex) {
      const prev = series.values[i - 1];
      if (prev !== null && prev !== undefined) {
        partial = `M${x(i - 1)},${y(prev)}L${x(i)},${y(value)}`;
      }
      pen = false;
      return;
    }
    solid.push(`${pen ? "L" : "M"}${x(i)},${y(value)}`);
    pen = true;
  });
  return (
    <g fill="none" stroke={series.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={solid.join("")} />
      {partial && <path d={partial} opacity={0.4} />}
    </g>
  );
}

interface EndLabel {
  key: string;
  text: string;
  color: string;
  pointX: number;
  pointY: number;
  labelY: number;
  partial: boolean;
}

/** Value labels at each line's last point; nudged apart only when they would collide. */
function placeEndLabels(
  series: LineSeries[],
  x: (i: number) => number,
  y: (v: number) => number,
  format: NumberFormat,
  partialIndex?: number,
): EndLabel[] {
  const labels = series.flatMap((s) => {
    const last = s.values.findLastIndex((v) => v !== null);
    if (last < 0) return [];
    const value = s.values[last]!;
    return [
      {
        key: s.key,
        text: formatNumber(value, format),
        color: s.color,
        pointX: x(last),
        pointY: y(value),
        labelY: y(value),
        partial: last === partialIndex,
      },
    ];
  });
  labels.sort((a, b) => a.pointY - b.pointY);
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1];
    const label = labels[i];
    const near = Math.abs(label.pointX - prev.pointX) < 48;
    if (near && label.labelY - prev.labelY < LABEL_GAP) {
      label.labelY = prev.labelY + LABEL_GAP;
    }
  }
  return labels;
}
