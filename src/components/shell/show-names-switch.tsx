"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { Switch } from "@wingmaite/starling-ui";

/**
 * "Show names" for tables of customer users. It toggles a URL param, so the
 * server only sends names when asked; hidden names never reach the browser.
 */
export function ShowNamesSwitch({
  checked,
  onHref,
  offHref,
}: {
  checked: boolean;
  onHref: string;
  offHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-label-sm">
      <Switch
        id={id}
        checked={checked}
        disabled={pending}
        onCheckedChange={(next) =>
          startTransition(() => router.replace(next ? onHref : offHref, { scroll: false }))
        }
      />
      Show names
    </label>
  );
}
