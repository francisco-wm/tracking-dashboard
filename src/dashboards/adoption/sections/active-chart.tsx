"use client";

import { useId, useState } from "react";
import { Switch } from "@wingmaite/starling-ui";

import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";

import { weeklyChart, weeklyTable } from "../chart-props";
import type { Period } from "../filters";

/**
 * Weekly active people with its trailing average, which the viewer can hide.
 * A display choice only: the data is the same, so nothing goes in the URL.
 */
export function ActiveChart({
  period,
  active,
  average,
}: {
  period: Period;
  active: LineSeries;
  average: LineSeries;
}) {
  const [showAverage, setShowAverage] = useState(true);
  const switchId = useId();
  const series = showAverage ? [active, average] : [active];

  return (
    <ChartCard
      className="lg:col-span-6"
      title="Weekly active people"
      subtitle="People who used wingmaite inside their organisation at least once that week"
      legend={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {showAverage && <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
          <label htmlFor={switchId} className="ml-auto flex cursor-pointer items-center gap-2 text-label-sm">
            <Switch id={switchId} checked={showAverage} onCheckedChange={setShowAverage} />
            Show {average.label}
          </label>
        </div>
      }
      table={weeklyTable(period, series)}
    >
      <LineChart
        {...weeklyChart(
          period,
          series,
          showAverage ? `Active people per week, with a ${average.label}` : "Active people per week",
        )}
      />
    </ChartCard>
  );
}
