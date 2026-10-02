"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { Select, Switch } from "@wingmaite/starling-ui";

export interface LinkOption {
  value: string;
  label: string;
  href: string;
}

/**
 * Time range and "Include internal users". Both only change URL params; the
 * server reads them, so links keep the view and nothing is decided client-side.
 */
export function FilterControls({
  range,
  rangeOptions,
  includeInternal,
  includeHref,
  excludeHref,
}: {
  range: string;
  rangeOptions: LinkOption[];
  includeInternal: boolean;
  includeHref: string;
  excludeHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const switchId = useId();
  const go = (href: string) => startTransition(() => router.push(href, { scroll: false }));
  const items = Object.fromEntries(rangeOptions.map((o) => [o.value, o.label]));

  return (
    <div className="flex flex-wrap items-center gap-3" aria-busy={pending}>
      <label htmlFor={switchId} className="flex cursor-pointer items-center gap-2 text-label-sm">
        <Switch
          id={switchId}
          checked={includeInternal}
          disabled={pending}
          onCheckedChange={(next) => go(next ? includeHref : excludeHref)}
        />
        Include internal users
      </label>
      <div className="w-44">
        <Select.Root
          value={range}
          items={items}
          disabled={pending}
          onValueChange={(value) => {
            const option = rangeOptions.find((o) => o.value === value);
            if (option) go(option.href);
          }}
        >
          <Select.Trigger aria-label="Time range" className="min-w-40 py-1.5" />
          <Select.Popup align="end">
            {rangeOptions.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Root>
      </div>
    </div>
  );
}
