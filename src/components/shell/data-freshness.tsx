"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@wingmaite/starling-ui";

import { refreshDashboard } from "@/lib/refresh-action";

function utcTime(iso: string) {
  return `${iso.slice(11, 16)} UTC`;
}

/** Viewer's own clock, e.g. "21:07 WEST". Only used after mount. */
function localTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  });
}

function relative(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

/** "Data as of" plus a refresh button that bypasses the 10-minute cache. */
export function DataFreshness({ asOf, dashboard, env }: { asOf: string; dashboard: string; env: string }) {
  const [now, setNow] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // Relative time only after mount, so the server and first client render match.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [asOf]);

  return (
    <div className="flex items-center gap-3">
      <p className="text-body-sm text-text-secondary" aria-live="polite">
        Data as of <time dateTime={asOf}>{now === null ? utcTime(asOf) : localTime(asOf)}</time>
        {now !== null && <span> · {relative(asOf, now)}</span>}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        iconLeft={<RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />}
        onClick={() => startTransition(() => refreshDashboard(dashboard, env))}
      >
        {pending ? "Refreshing" : "Refresh"}
      </Button>
    </div>
  );
}
