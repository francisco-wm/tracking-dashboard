import { Button } from "@wingmaite/starling-ui";
import { Suspense } from "react";

import { signIn } from "@/auth";
import { ALLOWED_DOMAIN, safeCallbackPath } from "@/lib/auth/policy";

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    // max-w-[24rem], not max-w-md: starling's --spacing-md (10px) shadows the width scale and collapsed the column.
    <main className="mx-auto flex min-h-screen w-full max-w-96 flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="font-serif text-heading-sm leading-tight">Tracking dashboard</h1>
        <p className="mt-2 text-body-sm text-text-secondary">Please login</p>
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
