"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { Switch } from "@wingmaite/starling-ui";

/**
 * "Include internal users". It only changes a URL param; the server reads it,
 * so links keep the view and nothing is decided client-side.
 */
export function FilterControls({
  includeInternal,
  includeHref,
  excludeHref,
}: {
  includeInternal: boolean;
  includeHref: string;
  excludeHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const switchId = useId();
  const go = (href: string) => startTransition(() => router.push(href, { scroll: false }));

  return (
    <label
      htmlFor={switchId}
      className="flex cursor-pointer items-center gap-2 text-label-sm"
      aria-busy={pending}
    >
      <Switch
        id={switchId}
        checked={includeInternal}
        disabled={pending}
        onCheckedChange={(next) => go(next ? includeHref : excludeHref)}
      />
      Include internal users
    </label>
  );
}
