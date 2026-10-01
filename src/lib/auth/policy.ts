// Who may use the app: verified Google Workspace accounts on wingmaite.com.

export const ALLOWED_DOMAIN = "wingmaite.com";

export function isAllowedEmail(email: string | null | undefined): email is string {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

/**
 * Checked at sign-in against Google's ID token: the email must be verified,
 * on the wingmaite domain, and the account must belong to the wingmaite
 * Workspace (the `hd` claim), not just carry a matching address.
 */
export function isAllowedGoogleProfile(
  profile: { email?: string | null; email_verified?: boolean | null; hd?: string | null } | null | undefined,
): boolean {
  if (!profile) return false;
  return profile.email_verified === true && profile.hd === ALLOWED_DOMAIN && isAllowedEmail(profile.email);
}

/**
 * Post-sign-in destination. Only a path on this site is kept: Auth.js passes
 * an absolute URL, so the origin is dropped and never trusted (no open redirects).
 */
export function safeCallbackPath(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "/dashboards";
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:")
      return `${url.pathname}${url.search}` || "/dashboards";
  } catch {
    // not a URL
  }
  return "/dashboards";
}
