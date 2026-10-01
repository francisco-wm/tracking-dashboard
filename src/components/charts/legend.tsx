export interface LegendItem {
  label: string;
  color: string;
  shape?: "line" | "rect" | "dashed";
}

/** Legend for two or more series; it mirrors the mark (line for lines, rect for bars). */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-secondary">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.shape === "rect" ? (
            <span className="size-2.5 rounded-[2px]" style={{ background: item.color }} />
          ) : item.shape === "dashed" ? (
            <span className="w-3.5 border-t border-dashed" style={{ borderColor: item.color }} />
          ) : (
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: item.color }} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}
