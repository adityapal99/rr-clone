import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * Server-only Supabase client using the secret key. Never import this from
 * a "use client" file -- the `server-only` guard below turns that mistake
 * into a build error rather than a runtime key leak.
 *
 * Lazy singleton: constructed on first use, then reused for the life of the
 * server isolate. There is no end-user session in this path (the route only
 * ever calls the `submit_contact_lead` RPC), so session persistence and
 * token refresh are explicitly disabled.
 */
let client: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (client) return client;

  const env = getServerEnv();
  client = createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-application-name": "trends-garments-web" },
    },
  });

  return client;
}
