import Link from "next/link";
import type { ReactNode } from "react";

import type { DashboardContext, DashboardModule } from "@/dashboards/types";
import { DEFAULT_ENV, ENV_KEYS, ENVIRONMENTS } from "@/lib/posthog/environments";
import { hrefWith } from "@/lib/url";

import { EnvSwitch } from "./env-switch";
import { SectionKeyNav } from "./section-key-nav";
import { SectionTabs } from "./section-tabs";
import { UserMenu } from "./user-menu";

/** Title, environment switch and section tabs. Shared by every dashboard. */
export function DashboardShell({
  dashboard,
  ctx,
  sectionIndex,
  userEmail,
  children,
}: {
  dashboard: DashboardModule;
  ctx: DashboardContext;
  sectionIndex: number;
  userEmail: string | null;
  children: ReactNode;
}) {
  const sectionHref = (slug: string) => hrefWith(`/dashboards/${dashboard.slug}/${slug}`, ctx.searchParams);
  const current = dashboard.sections[sectionIndex];
  const prev = dashboard.sections[sectionIndex - 1];
  const next = dashboard.sections[sectionIndex + 1];
  const note = dashboard.headerNote?.(ctx);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/dashboards" className="text-label-sm text-text-secondary hover:text-text-primary">
            wingmaite analytics
          </Link>
          <h1 className="mt-1 font-serif text-heading-sm sm:text-heading-md leading-tight">
            {dashboard.title}
          </h1>
          {note && <p className="mt-1 text-body-sm text-text-secondary">{note}</p>}
        </div>
        <div className="flex w-44 flex-col items-end gap-2">
          <UserMenu email={userEmail} />
          <EnvSwitch
            current={ctx.env}
            options={ENV_KEYS.map((key) => ({
              value: key,
              label: ENVIRONMENTS[key].label,
              href: hrefWith(`/dashboards/${dashboard.slug}/${current.slug}`, ctx.searchParams, {
                env: key === DEFAULT_ENV ? null : key,
              }),
            }))}
          />
        </div>
      </header>

      <SectionTabs
        current={current.slug}
        tabs={dashboard.sections.map((s) => ({ slug: s.slug, label: s.label, href: sectionHref(s.slug) }))}
      />
      <SectionKeyNav
        prevHref={prev ? sectionHref(prev.slug) : null}
        nextHref={next ? sectionHref(next.slug) : null}
      />

      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
