import { signOut } from "@/auth";

/** Signed-in email and a sign-out button; a plain note while sign-in is off. */
export function UserMenu({ email }: { email: string | null }) {
  if (email === null) {
    return <p className="text-label-xs text-text-secondary">Local development · sign-in off</p>;
  }
  return (
    <form
      className="flex items-center gap-2 text-label-xs text-text-secondary"
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/sign-in" });
      }}
    >
      <span className="truncate">{email}</span>
      <span aria-hidden="true">·</span>
      <button type="submit" className="underline-offset-2 hover:text-text-primary hover:underline">
        Sign out
      </button>
    </form>
  );
}
