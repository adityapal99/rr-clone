/**
 * Pure WhatsApp Cloud API request/response helpers for whatsapp-notify.
 * Kept dependency- and fetch-free so they can be unit tested without a
 * network call or a mock WhatsApp server.
 */

export function whatsappMessagesUrl(apiVersion: string, phoneNumberId: string): string {
  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
}

// WhatsApp rejects template parameter text containing a newline/tab or 4+
// consecutive spaces outright (400 Bad Request) -- this is not a style
// preference, it's a hard API validation rule. A lead's free-text message
// can easily contain a newline, so every parameter goes through this before
// being placed in a template component.
const NEWLINE_OR_TAB_RE = /[\r\n\t]+/g;
const FOUR_PLUS_SPACES_RE = / {4,}/g;

// Defensive cap on a single parameter's length. WhatsApp's documented limit
// is on the *template's own* static text (1024 chars across header/body/
// footer/buttons combined), which is a different thing from a per-parameter
// runtime substitution limit that isn't precisely documented -- so this is
// a deliberately conservative value, not a verified API ceiling. The
// message parameter in particular is here to alert staff to check the
// dashboard/email for the full enquiry, not to reproduce it in full.
const MAX_PARAM_LEN = 300;

export function sanitizeTemplateParam(value: string): string {
  const withoutNewlines = value.replace(NEWLINE_OR_TAB_RE, " ");
  const collapsedSpaces = withoutNewlines.replace(FOUR_PLUS_SPACES_RE, "   ");
  const trimmed = collapsedSpaces.trim();
  return trimmed.length > MAX_PARAM_LEN ? `${trimmed.slice(0, MAX_PARAM_LEN - 1)}…` : trimmed;
}

export interface LeadNotificationInput {
  templateName: string;
  languageCode: string;
  /** E.164, including the leading '+' -- see whatsapp_recipients_phone_format. */
  to: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
}

/**
 * Builds a template-message request body. Business-initiated messages (this
 * is one -- staff haven't messaged the business number first) MUST use a
 * pre-approved template; WhatsApp will reject free-text here. The template
 * itself -- its name, language, and exactly 4 body placeholders in this
 * order (name, email, phone, message) -- must be created and approved in
 * Meta Business Manager before this works. See the README's WhatsApp setup
 * section.
 */
export function buildTemplateMessageBody(input: LeadNotificationInput) {
  return {
    messaging_product: "whatsapp" as const,
    recipient_type: "individual" as const,
    to: input.to,
    type: "template" as const,
    template: {
      name: input.templateName,
      language: { code: input.languageCode },
      components: [
        {
          type: "body" as const,
          parameters: [
            { type: "text" as const, text: sanitizeTemplateParam(input.name) },
            { type: "text" as const, text: sanitizeTemplateParam(input.email) },
            { type: "text" as const, text: sanitizeTemplateParam(input.phone ?? "—") },
            { type: "text" as const, text: sanitizeTemplateParam(input.message) },
          ],
        },
      ],
    },
  };
}

export type WhatsappOutcome = "sent" | "failed" | "dead";

/**
 * Error codes that are permanent for the specific recipient/template
 * involved -- retrying will never succeed without a human fixing the
 * template, the recipient's number, or (for 131050) nothing at all, since
 * that recipient has opted out and must not be retried.
 *
 *   132001/132000/132015/132016 -- template missing, unapproved, paused, or
 *     disabled, or a parameter-count mismatch. Affects every recipient
 *     identically -- if one notification dies with one of these, expect
 *     every other pending notification to die the same way until the
 *     template itself is fixed.
 *   131026/131021/131037 -- not a WhatsApp number, sender==recipient, or a
 *     display-name issue. Recipient-specific; fix the phone number entry in
 *     whatsapp_recipients.
 *   131050 -- recipient opted out of marketing messages. Must not be
 *     retried; deactivate the recipient (is_active = false) once noticed.
 *
 * Deliberately NOT in this set: rate limits (429) and auth errors (401/403,
 * codes 0/190/200/10). Those are retried as `failed` and ride the same
 * attempt cap as everything else (see sweep_whatsapp_notifications) --
 * consistent with how this project always treats "fix a shared credential"
 * problems: let the cap turn a run of failures into `dead` rows, which is
 * the human-visible signal that something needs attention, rather than
 * special-casing a global circuit breaker.
 */
const TERMINAL_ERROR_CODES = new Set([
  132001, 132000, 132015, 132016, // template issues
  131026, 131021, 131037, // phone/number issues
  131050, // recipient opted out
]);

export function classifyWhatsappStatus(status: number, errorCode?: number): WhatsappOutcome {
  if (status >= 200 && status < 300) return "sent";
  if (errorCode !== undefined && TERMINAL_ERROR_CODES.has(errorCode)) return "dead";
  return "failed";
}

/** Exponential backoff in minutes, capped at 60 -- see the retry index. */
export function computeBackoffMinutes(attempts: number): number {
  return Math.min(2 ** attempts, 60);
}

export interface WhatsappErrorInfo {
  status: number;
  code?: number;
  subcode?: number;
  message: string;
  /** Meta's equivalent of a support correlation id. */
  fbtraceId?: string;
}

function truncate(value: string, maxLen: number): string {
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}

/**
 * Extracts the Cloud API's error shape ({error: {message, code,
 * error_subcode, fbtrace_id}}). fbtrace_id is what Meta support asks for,
 * and net._http_response (pg_net's own response log) ages out after 6
 * hours -- this is the only place that value survives.
 */
export function extractWhatsappError(status: number, body: unknown): WhatsappErrorInfo {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as Record<string, unknown>).error;
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      return {
        status,
        code: typeof e.code === "number" ? e.code : undefined,
        subcode: typeof e.error_subcode === "number" ? e.error_subcode : undefined,
        message: typeof e.message === "string" ? truncate(e.message, 500) : `HTTP ${status}`,
        fbtraceId: typeof e.fbtrace_id === "string" ? e.fbtrace_id : undefined,
      };
    }
  }
  return { status, message: `HTTP ${status}` };
}

export function formatErrorForStorage(info: WhatsappErrorInfo): string {
  const parts = [`${info.status}`];
  if (info.code !== undefined) parts.push(`code=${info.code}`);
  if (info.subcode !== undefined) parts.push(`subcode=${info.subcode}`);
  parts.push(info.message);
  if (info.fbtraceId) parts.push(`fbtrace_id=${info.fbtraceId}`);
  return truncate(parts.join(" "), 500);
}
