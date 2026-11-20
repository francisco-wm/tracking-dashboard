import { Button } from "@wingmaite/starling-ui";
import Link from "next/link";

import { signOut } from "@/auth";
import { DASHBOARDS } from "@/dashboards/registry";
import { AUTH_REQUIRED } from "@/lib/auth/mode";

export default function DashboardsIndex() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label-sm text-text-secondary">wingmaite analytics</p>
          <h1 className="mt-1 font-serif text-heading-md leading-tight">Dashboards</h1>
        </div>
        {/* Nothing to sign out of while sign-in is off (local dev). */}
        {AUTH_REQUIRED && (
          <form
            action={async () => {
              "use server";
              // Deletes the session cookie; the session is a JWT, so no login data is kept server-side.
              await signOut({ redirectTo: "/sign-in" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        )}
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {DASHBOARDS.map((dashboard) => (
          <li key={dashboard.slug}>
            <Link
              href={`/dashboards/${dashboard.slug}/${dashboard.sections[0].slug}`}
              className="block rounded-lg border border-border-default bg-background-light p-5 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
            >
              <h2 className="font-serif text-title-lg">{dashboard.title}</h2>
              <p className="mt-1 text-body-sm text-text-secondary">{dashboard.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
