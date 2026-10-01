import type { ReactNode } from "react";

import { HowMeasured } from "./how-measured";

/**
 * Every section: one plain sentence from the data, any notes, the charts,
 * then the collapsed "How this is measured".
 */
export function SectionFrame({
  sentence,
  notes = [],
  howMeasured,
  children,
}: {
  sentence: string;
  notes?: ReactNode[];
  howMeasured: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-4xl font-serif text-title-lg leading-snug sm:text-heading-sm">{sentence}</p>
      {notes.map((note, i) => (
        <p
          key={i}
          role="note"
          className="rounded-lg border border-border-default bg-background-light px-4 py-3 text-body-sm"
        >
          {note}
        </p>
      ))}
      <div className="grid gap-4 lg:grid-cols-6">{children}</div>
      <HowMeasured>{howMeasured}</HowMeasured>
    </div>
  );
}

export function NoSendYet() {
  return (
    <p className="font-serif text-title-lg leading-snug">
      The first send hasn’t happened yet, so there is nothing to compare.
    </p>
  );
}
