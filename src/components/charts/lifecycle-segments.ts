// Shared by the client chart and server-rendered legends, so it lives outside
// the "use client" module.
export const LIFECYCLE_SEGMENTS = [
  { key: "returning", label: "Returning", color: "var(--color-chart-returning)" },
  { key: "newPeople", label: "New", color: "var(--color-chart-new)" },
  { key: "cameBack", label: "Came back after a break", color: "var(--color-chart-came-back)" },
] as const;

export const DROPPED_OFF = { label: "Dropped off", color: "var(--color-chart-dropped)" };
