import { Button } from "@wingmaite/starling-ui";
import { Suspense } from "react";

import { signIn } from "@/auth";
import { ALLOWED_DOMAIN, safeCallbackPath } from "@/lib/auth/policy";

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4">
      <div>
        <p className="text-label-sm text-text-secondary">wingmaite analytics</p>
        <h1 className="mt-1 font-serif text-heading-sm leading-tight">Sign in</h1>
        <p className="mt-2 text-body-sm text-text-secondary">
          These dashboards include customer names, so they are only open to {ALLOWED_DOMAIN} Google accounts.
        </p>
      </div>
      <Suspense>
        <SignInForm {...props} />
      </Suspense>
    </main>
  );
}

async function SignInForm({ searchParams }: PageProps<"/sign-in">) {
  const query = await searchParams;
  const redirectTo = safeCallbackPath(query.callbackUrl);
  const failed = query.error !== undefined;
  return (
    <>
      {failed && (
        <p
          role="alert"
          className="rounded-lg border border-border-danger px-4 py-3 text-body-sm text-text-danger"
        >
          That account can’t sign in. Use your verified @{ALLOWED_DOMAIN} Google Workspace account.
        </p>
      )}
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo });
        }}
      >
        <Button type="submit" variant="primary">
          Continue with Google
        </Button>
      </form>
    </>
  );
}
