import { Fragment, type ReactNode } from "react";

import { TRACKED, type DataKey } from "../config";

/** `event`, or `property` on `event` when the event exists before the property. */
export function DataName({ dataKey }: { dataKey: DataKey }) {
  const { event, property } = TRACKED[dataKey];
  return property ? (
    <>
      <code>{property}</code> on <code>{event}</code>
    </>
  ) : (
    <code>{event}</code>
  );
}

/** "a, b and c" for data names. */
export function DataNames({ keys }: { keys: DataKey[] }) {
  return (
    <>
      {keys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && (i === keys.length - 1 ? " and " : ", ")}
          <DataName dataKey={key} />
        </Fragment>
      ))}
    </>
  );
}

/** A card whose data isn't in this project yet: names what it waits for and what it will show. */
export function WaitingCard({
  title,
  keys,
  children,
  className,
}: {
  title: string;
  keys: DataKey[];
  /** What the card will show once the data arrives. */
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-2 rounded-lg border border-dashed border-border-strong p-5 [&_code]:text-[0.9em] ${className ?? ""}`}
    >
      <h3 className="text-title-sm font-medium leading-snug">{title}</h3>
      <p className="text-body-sm text-text-secondary">
        Waiting for <DataNames keys={keys} />, which this project doesn’t have yet. {children}
      </p>
    </section>
  );
}
