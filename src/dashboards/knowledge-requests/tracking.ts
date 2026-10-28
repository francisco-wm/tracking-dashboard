// Which data each card can rely on. Events and properties reach each project at
// different times. A card waits, naming what it needs, until all of it has
// appeared; then it counts every request sent in the range, with its events
// whenever they happened. When something first appeared inside the range, the
// page says so: anything before that day wasn't recorded.

import type { ISODate } from "@/lib/dates";

import { DATA_KEYS, type DataKey } from "./config";
import type { Period } from "./filters";

/** The first day each piece of data appeared in the project; null = not yet. */
export type TrackingStatus = Record<DataKey, ISODate | null>;

/** A tracking-status query row: `<key>_since` (a date) and `<key>_events` (a count) per key. */
export function parseTrackingStatus(record: Record<string, unknown>): TrackingStatus {
  const status = {} as TrackingStatus;
  for (const key of DATA_KEYS) {
    const events = Number(record[`${key}_events`] ?? 0) || 0;
    const since = String(record[`${key}_since`] ?? "").slice(0, 10);
    // An aggregate over no rows reads 1970-01-01; the count is what says "never".
    status[key] = events > 0 && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : null;
  }
  return status;
}

/** Whether every one of `keys` has appeared in the project. */
export function isTracked(status: TrackingStatus, keys: DataKey[]): boolean {
  return keys.every((key) => status[key] !== null);
}

/** The data among `keys` that hasn't appeared yet, in the order given. */
export function missing(status: TrackingStatus, keys: DataKey[]): DataKey[] {
  return keys.filter((key) => status[key] === null);
}

export interface TrackingStart {
  key: DataKey;
  date: ISODate;
}

/** Of `keys`, those that first appeared after the first counted day, oldest first. */
export function startedInPeriod(status: TrackingStatus, period: Period, keys: DataKey[]): TrackingStart[] {
  return keys
    .flatMap((key) => {
      const date = status[key];
      return date !== null && date > period.from ? [{ key, date }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
