/**
 * Sign-in is off in local development for now and always on in production
 * builds (`next build` / `next start`, Vercel). A production build without
 * AUTH_SECRET and the Google client therefore fails closed: nobody gets in.
 */
export const AUTH_REQUIRED = process.env.NODE_ENV === "production";
