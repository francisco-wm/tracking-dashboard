"use client";

import { useRouter } from "next/navigation";
import { Select } from "@wingmaite/starling-ui";

export interface EnvOption {
  value: string;
  label: string;
  href: string;
}

/** Production / Staging. Only environment keys travel; the server maps them to project IDs. */
export function EnvSwitch({ current, options }: { current: string; options: EnvOption[] }) {
  const router = useRouter();
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <Select.Root
      value={current}
      items={items}
      onValueChange={(value) => {
        const option = options.find((o) => o.value === value);
        if (option) router.push(option.href, { scroll: false });
      }}
    >
      <Select.Trigger aria-label="Environment" className="min-w-40 py-1.5" />
      <Select.Popup align="end">
        {options.map((option) => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  );
}
