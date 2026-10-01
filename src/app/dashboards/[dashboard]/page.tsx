import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/skeletons";
import { getDashboard } from "@/dashboards/registry";
import { hrefWith } from "@/lib/url";

// This route only redirects; there is no UI to validate for instant navigation.
export const instant = false;

export default function DashboardRoute(props: PageProps<"/dashboards/[dashboard]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RedirectToFirstSection {...props} />
    </Suspense>
  );
}

/** /dashboards/<slug> → its first section, keeping ?env and other params. */
async function RedirectToFirstSection({ params, searchParams }: PageProps<"/dashboards/[dashboard]">) {
  const [{ dashboard: slug }, query] = await Promise.all([params, searchParams]);
  const dashboard = getDashboard(slug);
  if (!dashboard) notFound();
  return redirect(hrefWith(`/dashboards/${slug}/${dashboard.sections[0].slug}`, query));
}
