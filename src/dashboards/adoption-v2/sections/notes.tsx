import { formatDayMonth, type ISODate } from "@/lib/dates";

export { WeeksNote, WhoIsCounted } from "../../adoption/sections/notes";

/** Shared lines for the "How this is measured" notes. */

export function CoreActionNote() {
  return (
    <p>
      <strong>Active</strong> means at least one core action that week: a message in a regular chat, a draft
      written, edited or listed (shared with the organisation or a group in it), a file uploaded to company
      knowledge or attached in a chat, or a knowledge request sent or answered. Logins and page views don’t
      count.
    </p>
  );
}

export function SourcedNote({ since }: { since: ISODate }) {
  return (
    <p>
      A <strong>sourced answer</strong> is a chat message whose answer cites at least one of the
      organisation’s fragments (<code>knowledge_fragment_used_in_response</code> with{" "}
      <code>usage = cited</code>) before the chat’s next message. Fragments that were only retrieved don’t
      count. Citations are tracked since {formatDayMonth(since)}: earlier weeks have no value, and that week
      counts only from then.
    </p>
  );
}

export function GapNote() {
  return (
    <p>
      The <strong>knowledge gap rate</strong> is the share of chat messages whose answer cited nothing. It is
      not the same as a knowledge gap the AI detects in a chat (<code>knowledge_gap_detected</code>), when it
      drafts a knowledge request: most uncited answers have no detected gap.
    </p>
  );
}

export function SmallNote() {
  return <p>Every share shows its count. Shares over fewer than 5 are greyed out: too few to read.</p>;
}

export function MarkersNote() {
  return (
    <p>
      <strong>Markers</strong> on the weekly charts come from the annotations list (releases, holidays,
      customer events) in this dashboard’s <code>config.ts</code>.
    </p>
  );
}
