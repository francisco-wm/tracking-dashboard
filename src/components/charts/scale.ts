export type Scale = (value: number) => number;

export function linearScale([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]): Scale {
  const span = d1 - d0 || 1;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** A "nice" step (1, 2, 2.5, 5 × 10^n) so ticks land on clean numbers. */
function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const factor = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10;
  return factor * magnitude;
}

export interface Ticks {
  min: number;
  max: number;
  values: number[];
}

/**
 * Clean ticks covering [min, max], always including 0. Integer data
 * (`integers`) never gets fractional ticks.
 */
export function niceTicks(min: number, max: number, count = 4, integers = true): Ticks {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (hi === lo) return { min: 0, max: 1, values: [0, 1] };
  let step = niceStep((hi - lo) / count);
  if (integers) step = Math.max(1, Math.round(step));
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const values: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) values.push(Number(v.toFixed(10)));
  return { min: start, max: end, values };
}

const intFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 });

export type NumberFormat = "int" | "decimal" | "percent";

export function formatNumber(value: number, format: NumberFormat = "int"): string {
  if (format === "decimal") return decimalFormat.format(value);
  if (format === "percent") return percentFormat.format(value);
  return intFormat.format(value);
}
