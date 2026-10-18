import "server-only";

/**
 * Server-only environment access for the contact-lead pipeline.
 *
 * `server-only` makes it a build error (not a code-review miss) for this
 * module to end up in a client bundle -- there is no other convention in
 * this repo yet (no ESLint boundary rule) that would catch
 * `SUPABASE_SECRET_KEY` leaking into the browser.
 *
 * Validated lazily and memoized, not at module import: throwing at import
 * time would fail `next build` on any machine or CI runner that doesn't
 * have these secrets configured, which is a bad trade for a marketing site.
 * Memoizing means the check runs once per server isolate, not once per
 * request.
 */

export interface ServerEnv {
  supabaseUrl: string;
  supabaseSecretKey: string;
  contactIpHashSalt: string;
}

let cached: ServerEnv | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  cached = {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseSecretKey: required("SUPABASE_SECRET_KEY"),
    contactIpHashSalt: required("CONTACT_IP_HASH_SALT"),
  };

  return cached;
}
