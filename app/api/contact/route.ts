import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { validateContactPayload } from "@/lib/contact/validate";
import { getClientIp, hashForRateLimit } from "@/lib/contact/rate-limit";
import { getServerEnv } from "@/lib/env";

// Reject an oversized body before even parsing it as JSON.
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Contact form submission endpoint.
 *
 * Inserts into Supabase's `contact_leads` table (via the
 * `submit_contact_lead` RPC, which also enforces rate limits) using the
 * server-side secret key -- no Supabase credential ever reaches the
 * browser. From there, a database trigger + a 15-minute cron sweep send a
 * WhatsApp notification to every active recipient, and a daily 09:00 UAE
 * time job emails a spreadsheet of the previous day's leads. See
 * supabase/migrations and
 * supabase/functions/{whatsapp-notify,daily-leads-report}.
 *
 * Deliberately does not log the submitted name/email/phone/message, nor
 * the raw client IP -- those are personal data. Only non-PII (error codes,
 * lead ids) is ever logged.
 *
 * Checks run cheapest-first so an automated request costs as little as
 * possible before being rejected:
 *   1. body size cap
 *   2. honeypot (a bot fills in a field real visitors never see)
 *   3. shape/length validation
 *   4. rate limiting (in Postgres -- see submit_contact_lead)
 */
export async function POST(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = validateContactPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { name, email, phone, message, locale, company } = result.value;

  // Honeypot hit: report success without persisting anything. Returning
  // 200 (not 400) denies the bot any signal about what tripped the check.
  if (company.length > 0) {
    return NextResponse.json({ ok: true });
  }

  let env;
  try {
    env = getServerEnv();
  } catch (error) {
    console.error("[contact] server misconfigured:", (error as Error).message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const ip = getClientIp(request.headers);
  const ipHash = hashForRateLimit(ip, env.contactIpHashSalt);
  const emailHash = hashForRateLimit(email, env.contactIpHashSalt);

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_contact_lead", {
    p_name: name,
    p_email: email,
    p_phone: phone || null,
    p_message: message,
    p_locale: locale,
    p_ip_hash: ipHash,
    p_email_hash: emailHash,
  });

  if (error) {
    // Never surface database error text to the client, and never log PII.
    console.error("[contact] submit_contact_lead failed:", error.code);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const outcome = data as { ok: boolean; reason?: string; id?: number };

  if (!outcome.ok) {
    if (outcome.reason === "rate_limited_ip" || outcome.reason === "rate_limited_email") {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": "600" } },
      );
    }
    console.error("[contact] submit_contact_lead returned unexpected reason:", outcome.reason);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
