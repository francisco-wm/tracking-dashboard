"use client";

import { useState } from "react";

import { roundedBottomBar, roundedTopBar } from "./bar-chart";
import { ChartTooltip } from "./chart-tooltip";
import { DROPPED_OFF, LIFECYCLE_SEGMENTS } from "./lifecycle-segments";
import type { ChartMarker } from "./line-chart";
import { formatNumber, linearScale, markerRows, niceTicks } from "./scale";
import { useMeasuredWidth } from "./use-measured-width";

export interface LifecycleBar {
  label: string;
  title: string;
  returning: number;
  newPeople: number;
  cameBack: number;
  droppedOff: number;
}

const MARGIN = { top: 22, right: 8, bottom: 26, left: 40 };
const MAX_BAR = 24;
const GAP = 2; // surface gap between stacked segments

/**
 * Weekly lifecycle: returning, new and "came back" stacked above the axis
 * ("came back" on top, in the accent), dropped off below it as negative.
 */
export function LifecycleChart({
  bars,
  xTickIndices,
  markers = [],
  partialIndex,
  height = 280,
  ariaLabel,
}: {
  bars: LifecycleBar[];
  xTickIndices: number[];
  markers?: ChartMarker[];
  partialIndex?: number;
  height?: number;
  ariaLabel: string;
}) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const maxUp = Math.max(0, ...bars.map((b) => b.returning + b.newPeople + b.cameBack));
  const maxDown = Math.max(0, ...bars.map((b) => b.droppedOff));
  const ticks = niceTicks(-maxDown, maxUp, 5);
  const y = linearScale([ticks.min, ticks.max], [MARGIN.top + plotH, MARGIN.top]);
  const band = bars.length ? plotW / bars.length : 0;
  const barW = Math.min(MAX_BAR, Math.max(2, band - 3));
  const center = (i: number) => MARGIN.left + band * i + band / 2;
  const zero = y(0);
  const labelRows = markerRows(
    markers.map((m) => ({ x: center(m.index), label: m.label, end: m.index > bars.length * 0.8 })),
  );

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
                {formatNumber(Math.abs(tick))}
              </text>
            </g>
          ))}
          {xTickIndices.map((i) => (
            <text
              key={i}
              x={center(i)}
              y={height - 8}
              textAnchor={i === 0 ? "start" : i === bars.length - 1 ? "end" : "middle"}
              className="fill-text-secondary text-[11px]"
            >
              {bars[i].label}
            </text>
          ))}
          {markers.map((marker, i) => (
            <g key={`${marker.index}-${marker.label}`}>
              <line
                x1={center(marker.index)}
                x2={center(marker.index)}
                y1={MARGIN.top - 4}
                y2={MARGIN.top + plotH}
                stroke="var(--color-chart-marker)"
                strokeDasharray="4 3"
              />
              <text
                x={center(marker.index)}
                y={MARGIN.top - 9 - labelRows[i] * 12}
                textAnchor={marker.index > bars.length * 0.8 ? "end" : "middle"}
                className="fill-text-secondary text-[11px]"
              >
                {marker.label}
              </text>
            </g>
          ))}
          {bars.map((bar, i) => {
            const x0 = center(i) - barW / 2;
            const dim = active !== null && active !== i ? 0.55 : i === partialIndex ? 0.45 : 1;
            const segments = LIFECYCLE_SEGMENTS.map((s) => ({ ...s, value: bar[s.key] })).filter(
              (s) => s.value > 0,
            );
            let base = 0;
            return (
              <g key={i} opacity={dim}>
                {segments.map((segment, j) => {
                  const top = y(base + segment.value);
                  const bottom = y(base) - (j > 0 ? GAP : 0);
                  base += segment.value;
                  const h = bottom - top;
                  if (h <= 0) return null;
                  const isEnd = j === segments.length - 1;
                  return isEnd ? (
                    <path key={segment.key} d={roundedTopBar(x0, top, barW, h)} fill={segment.color} />
                  ) : (
                    <rect key={segment.key} x={x0} y={top} width={barW} height={h} fill={segment.color} />
                  );
                })}
                {bar.droppedOff > 0 && (
                  <path
                    d={roundedBottomBar(x0, zero + GAP, barW, y(-bar.droppedOff) - zero - GAP)}
                    fill={DROPPED_OFF.color}
                  />
                )}
              </g>
            );
          })}
          <line
            x1={MARGIN.left}
            x2={MARGIN.left + plotW}
            y1={zero}
            y2={zero}
            stroke="var(--color-text-secondary)"
            strokeWidth={1}
          />
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
            ...[...LIFECYCLE_SEGMENTS].reverse().map((s) => ({
              key: s.key,
              label: s.label,
              color: s.color,
              keyShape: "rect" as const,
              value: formatNumber(bars[active][s.key]),
            })),
            {
              key: "droppedOff",
              label: DROPPED_OFF.label,
              color: DROPPED_OFF.color,
              keyShape: "rect" as const,
              value: formatNumber(bars[active].droppedOff),
            },
          ]}
        />
      )}
    </div>
  );
}
