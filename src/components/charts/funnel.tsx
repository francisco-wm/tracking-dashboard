import { InfoTip } from "./info-tip";
import { formatNumber } from "./scale";

export interface FunnelStep {
  label: string;
  count: number;
}

/** Horizontal funnel; every step is labelled with its count and share of the first step. */
export function Funnel({
  title,
  subtitle,
  steps,
  info,
  numbered = true,
}: {
  title: string;
  subtitle?: string;
  steps: FunnelStep[];
  /** What the funnel tells you and which decision it helps with, behind an info icon. */
  info?: string;
  /** Off for a breakdown rather than steps in order: bars still show each row's share of the first. */
  numbered?: boolean;
}) {
  const first = steps[0]?.count ?? 0;
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-background-light p-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-title-sm font-medium leading-snug">{title}</h3>
          {subtitle && <p className="mt-0.5 text-body-sm text-text-secondary">{subtitle}</p>}
        </div>
        {info && <InfoTip title={title} text={info} />}
      </header>
      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => {
          const share = first > 0 ? step.count / first : 0;
          return (
            <li key={step.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-body-sm">
                <span>
                  {numbered && <span className="text-text-secondary">{i + 1}. </span>}
                  {step.label}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{formatNumber(step.count)}</span>
                  {i > 0 && <span className="text-text-secondary"> · {formatNumber(share, "percent")}</span>}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-chart-grid">
                {step.count > 0 && (
                  <div
                    className="h-2.5 rounded-full bg-chart-1"
                    style={{ width: `${Math.max(2, share * 100)}%` }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
