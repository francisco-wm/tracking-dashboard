import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { AUTH_REQUIRED } from "./mode";
import { isAllowedEmail } from "./policy";

/** The signed-in wingmaite user, or a redirect to sign-in. `email` is null while sign-in is off. */
export async function requireUser(): Promise<{ email: string | null }> {
  if (!AUTH_REQUIRED) return { email: null };
  const session = await auth();
  const email = session?.user?.email;
  if (!isAllowedEmail(email)) redirect("/sign-in");
  return { email };
}
