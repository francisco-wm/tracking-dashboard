import type { ISODate } from "@/lib/dates";

export const DASHBOARD_SLUG = "knowledge-champions";

/** Every send of the quarterly email. The latest one on or before today drives the page. */
export const SEND_DATES: readonly ISODate[] = ["2026-10-01"];
