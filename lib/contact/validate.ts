/**
 * Contact-form payload validation. Extracted out of the route handler so it
 * is a pure function that can be unit tested without a request/response
 * round trip.
 *
 * Length caps mirror the `contact_leads` table's check constraints
 * (supabase/migrations/20261007173236_contact_leads_table.sql) so an
 * oversized payload is rejected here, at the edge, rather than surfacing as
 * a database constraint violation. They also bound the worst case for the
 * daily report's spreadsheet generation and for a WhatsApp template
 * parameter (see sanitizeTemplateParam's own, stricter truncation).
 */

export interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  message: string;
  locale: string;
  /** Honeypot field. Bots fill it in; real visitors never see it. */
  company: string;
}

export type ContactValidationError =
  | "invalid_body"
  | "name_required"
  | "name_too_long"
  | "email_invalid"
  | "email_too_long"
  | "phone_too_long"
  | "message_required"
  | "message_too_long"
  | "locale_invalid";

export type ContactValidationResult =
  | { ok: true; value: ContactPayload }
  | { ok: false; error: ContactValidationError };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORTED_LOCALES = new Set(["en", "ar"]);

const MAX_NAME_LEN = 200;
const MAX_EMAIL_LEN = 320;
const MAX_PHONE_LEN = 40;
const MAX_MESSAGE_LEN = 5000;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Validates and normalizes a raw JSON body into a ContactPayload. Trimming
 * happens here too (not just in the database's normalise trigger) so
 * length checks apply to the trimmed value the same way the trigger does.
 */
export function validateContactPayload(body: unknown): ContactValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }

  const v = body as Record<string, unknown>;

  const name = asString(v.name).trim();
  if (name.length === 0) return { ok: false, error: "name_required" };
  if (name.length > MAX_NAME_LEN) return { ok: false, error: "name_too_long" };

  const email = asString(v.email).trim().toLowerCase();
  if (email.length > MAX_EMAIL_LEN) return { ok: false, error: "email_too_long" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "email_invalid" };

  const phone = asString(v.phone).trim();
  if (phone.length > MAX_PHONE_LEN) return { ok: false, error: "phone_too_long" };

  const message = asString(v.message).trim();
  if (message.length === 0) return { ok: false, error: "message_required" };
  if (message.length > MAX_MESSAGE_LEN) return { ok: false, error: "message_too_long" };

  const rawLocale = asString(v.locale).trim().toLowerCase();
  const locale = SUPPORTED_LOCALES.has(rawLocale) ? rawLocale : "en";

  const company = asString(v.company).trim();

  return {
    ok: true,
    value: { name, email, phone, message, locale, company },
  };
}
