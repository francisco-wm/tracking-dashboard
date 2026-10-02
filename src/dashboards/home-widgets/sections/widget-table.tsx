// Named exports: dotted compound access (TableRoot) is not available from a server component.
import {
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@wingmaite/starling-ui";
import type { ReactNode } from "react";

/**
 * A titled card holding a small table: for breakdowns that are better read than
 * drawn. The first `labelColumns` columns name the row; the rest are numbers,
 * right-aligned.
 */
export function WidgetTable({
  title,
  subtitle,
  columns,
  rows,
  empty,
  labelColumns = 1,
  className,
}: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: ReactNode[][];
  empty: string;
  labelColumns?: number;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-lg border border-border-default bg-background-light p-5 ${className ?? ""}`}
    >
      <header>
        <h3 className="text-title-sm font-medium leading-snug">{title}</h3>
        {subtitle && <p className="mt-0.5 text-body-sm text-text-secondary">{subtitle}</p>}
      </header>
      {rows.length === 0 ? (
        <p className="text-body-sm text-text-secondary">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <TableRoot density="sm">
            <TableHeader>
              <TableRow>
                {columns.map((column, j) => (
                  <TableHeaderCell key={column} align={j >= labelColumns ? "right" : undefined}>
                    {column}
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} align={j >= labelColumns ? "right" : undefined}>
                      {j >= labelColumns ? <span className="tabular-nums">{cell}</span> : cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </TableRoot>
        </div>
      )}
    </section>
  );
}
