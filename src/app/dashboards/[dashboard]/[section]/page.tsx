import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardShell } from "@/components/shell/dashboard-shell";
import { DataFreshness } from "@/components/shell/data-freshness";
import { PageSkeleton, SectionSkeleton } from "@/components/shell/skeletons";
import { getDashboard } from "@/dashboards/registry";
import type { DashboardContext, SectionModule } from "@/dashboards/types";
import { requireUser } from "@/lib/auth/session";
import { todayUTC } from "@/lib/dates";
import { ENVIRONMENTS, parseEnv } from "@/lib/posthog/environments";

export default function SectionRoute(props: PageProps<"/dashboards/[dashboard]/[section]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SectionPage {...props} />
    </Suspense>
  );
}

async function SectionPage({ params, searchParams }: PageProps<"/dashboards/[dashboard]/[section]">) {
  const [{ dashboard: slug, section: sectionSlug }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser();

  const dashboard = getDashboard(slug);
  if (!dashboard) notFound();
  const sectionIndex = dashboard.sections.findIndex((s) => s.slug === sectionSlug);
  if (sectionIndex < 0) notFound();
  const env = parseEnv(query.env);
  if (!env) notFound();

  const ctx: DashboardContext = {
    dashboard: slug,
    env,
    projectId: ENVIRONMENTS[env].projectId,
    today: todayUTC(),
    searchParams: query,
  };
  const section = dashboard.sections[sectionIndex];

  return (
    <DashboardShell dashboard={dashboard} ctx={ctx} sectionIndex={sectionIndex} userEmail={user.email}>
      <Suspense key={`${env}:${section.slug}`} fallback={<SectionSkeleton />}>
        <SectionBody section={section} ctx={ctx} />
      </Suspense>
    </DashboardShell>
  );
}

async function SectionBody({ section, ctx }: { section: SectionModule; ctx: DashboardContext }) {
  let result;
  try {
    result = await section.load(ctx);
  } catch (error) {
    // Our errors never contain the API key, so the message is safe to show.
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <div role="alert" className="rounded-lg border border-border-danger bg-background-light p-5">
        <p className="text-title-sm font-medium text-text-danger">Couldn’t load this section</p>
        <p className="mt-1 text-body-sm text-text-secondary">{message}</p>
      </div>
    );
  }
  const View = section.View;
  return (
    <>
      <div className="flex justify-end">
        <DataFreshness asOf={result.asOf} dashboard={ctx.dashboard} env={ctx.env} />
      </div>
      <View data={result.data} ctx={ctx} />
    </>
  );
}
