"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** Collapsed "How this is measured" note at the end of every section. */
export function HowMeasured({ children }: { children: ReactNode }) {
  return (
    <Collapsible className="rounded-lg border border-border-default">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-label-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded-lg">
        How this is measured
        <ChevronDown
          className="size-4 text-text-secondary transition-transform group-data-[panel-open]:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-5 pb-4">
        <div className="max-w-3xl space-y-2 text-body-sm leading-relaxed text-text-secondary [&_strong]:font-medium [&_strong]:text-text-primary">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
