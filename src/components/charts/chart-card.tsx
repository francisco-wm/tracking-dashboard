"use client";

import { useState, type ReactNode } from "react";

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

/**
 * A chart with its title, legend and a table view twin, so no value is only
 * reachable by hovering.
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  table?: ChartTable;
  className?: string;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section
      className={`flex flex-col gap-3 rounded-lg border border-border-default bg-background-light p-5 ${className ?? ""}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-title-sm font-medium leading-snug">{title}</h3>
          {subtitle && <p className="mt-0.5 text-body-sm text-text-secondary">{subtitle}</p>}
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className="shrink-0 rounded-full px-2.5 py-1 text-label-xs text-text-secondary hover:bg-pine-950/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
          >
            {showTable ? "Chart" : "Table"}
          </button>
        )}
      </header>
      {legend && !showTable && legend}
      {showTable && table ? <DataTable table={table} /> : children}
    </section>
  );
}

function DataTable({ table }: { table: ChartTable }) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-left text-body-sm">
        <thead className="sticky top-0 bg-background-light">
          <tr>
            {table.columns.map((column) => (
              <th key={column} scope="col" className="border-b border-border-default py-1.5 pr-3 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`border-b border-border-default py-1.5 pr-3 ${typeof cell === "number" ? "tabular-nums" : ""}`}
                >
                  {typeof cell === "number" ? cell.toLocaleString("en-GB") : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
