/**
 * Reads an Edge Function secret, throwing an error that names the variable
 * -- never its value -- so a missing secret fails loudly without ever
 * putting a credential into a log line or an error response.
 */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return Deno.env.get(name) || undefined;
}
