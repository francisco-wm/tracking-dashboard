// Every page needs a wingmaite session, except sign-in, the Auth.js routes and
// static assets. Pages and server actions check the session again
// (lib/auth/session.ts), so this is the first gate, not the only one.
// In local development sign-in is off (lib/auth/mode.ts).
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { AUTH_REQUIRED } from "@/lib/auth/mode";

export const proxy = AUTH_REQUIRED ? auth : () => NextResponse.next();

export const config = {
  matcher: ["/((?!api/auth|sign-in|_next/static|_next/image|favicon.ico).*)"],
};
