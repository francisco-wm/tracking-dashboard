import type { ISODate } from "@/lib/dates";

export const DASHBOARD_SLUG = "knowledge-champions";

/**
 * Every send of the quarterly email, planned ones too. The latest one on or
 * before today drives the page; later ones are ignored until their day.
 */
export const SEND_DATES: readonly ISODate[] = ["2026-10-01", "2027-01-01"];
