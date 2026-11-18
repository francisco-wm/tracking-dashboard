"use client";

import { Info } from "lucide-react";
import { Popover } from "@wingmaite/starling-ui";

/**
 * The info icon in a card's top-right corner: what the value tells you and
 * which decision it helps with. Opens on hover, keyboard focus or tap.
 */
export function InfoTip({ title, text }: { title: string; text: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label={`About ${title}`}
        className="-m-1 shrink-0 rounded-full p-1 text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
      >
        <Info className="size-4" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Popup side="bottom" align="end" className="max-w-[min(700px,calc(100vw-2rem))] text-body-sm">
        <Popover.Description>{text}</Popover.Description>
      </Popover.Popup>
    </Popover.Root>
  );
}
