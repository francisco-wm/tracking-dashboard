"use client";

import Link from "next/link";
import { Tabs } from "@wingmaite/starling-ui";

export interface TabLink {
  slug: string;
  label: string;
  href: string;
}

/** Section tabs as real links, so every section is linkable. */
export function SectionTabs({ tabs, current }: { tabs: TabLink[]; current: string }) {
  return (
    <nav aria-label="Sections" className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <Tabs.Root value={current}>
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.slug} value={tab.slug} nativeButton={false} render={<Link href={tab.href} />}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.Root>
    </nav>
  );
}
