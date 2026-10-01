import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { ALLOWED_DOMAIN, isAllowedEmail, isAllowedGoogleProfile } from "@/lib/auth/policy";

// Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // Pre-selects the wingmaite Workspace in Google's account chooser.
      // This is only a hint; the signIn callback below is the actual check.
      authorization: { params: { hd: ALLOWED_DOMAIN, prompt: "select_account" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  // Local `next start` and Vercel both work without AUTH_URL; Google only
  // redirects to the callback URLs registered on the OAuth client.
  trustHost: true,
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "google" && isAllowedGoogleProfile(profile);
    },
    // Used by proxy.ts: anything without a wingmaite session goes to /sign-in.
    authorized({ auth: session }) {
      return isAllowedEmail(session?.user?.email);
    },
  },
});
