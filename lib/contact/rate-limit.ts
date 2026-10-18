import "server-only";
import { createHash } from "node:crypto";

/**
 * IP extraction and hashing for the contact-form rate limiter. The actual
 * limit logic lives in Postgres (see consume_rate_limit /
 * submit_contact_lead in supabase/migrations) -- this module only prepares
 * the two keys the RPC checks against.
 *
 * The raw IP address never reaches the database or gets logged: only a
 * salted hash does. That keeps `contact_rate_limits` free of a new category
 * of personal data, and means the salt (CONTACT_IP_HASH_SALT) rotating
 * simply resets everyone's buckets rather than exposing anything.
 */

/**
 * `NextRequest.ip` was removed in Next 15 -- the client IP has to be read
 * from the `x-forwarded-for` header by hand. That header is a
 * comma-separated list appended to by every proxy hop; take the FIRST
 * entry (the original client), not the last.
 *
 * This is spoofable unless the platform you deploy to overwrites the
 * header at its own edge (Vercel does). If you deploy behind a proxy that
 * does not overwrite it, prefer a header your proxy sets itself (e.g.
 * `x-real-ip`) over trusting this blindly.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

export function hashForRateLimit(value: string, salt: string): string {
  return createHash("sha256").update(`${value}:${salt}`).digest("hex");
}
