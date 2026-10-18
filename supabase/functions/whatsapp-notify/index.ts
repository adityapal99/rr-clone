// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { optionalEnv, requireEnv } from "../_shared/env.ts";
import {
  buildTemplateMessageBody,
  classifyWhatsappStatus,
  computeBackoffMinutes,
  extractWhatsappError,
  formatErrorForStorage,
  whatsappMessagesUrl,
} from "../_shared/whatsapp.ts";
import type {
  ClaimedWhatsappNotification,
  WhatsappNotifyRequest,
  WhatsappNotifyResponse,
} from "../_shared/types.ts";

/**
 * Sends a WhatsApp template-message notification for every claimed
 * "lead x recipient" pair. Called two ways -- see
 * supabase/migrations/20261007173340_automation.sql for both:
 *
 *   1. The after-insert trigger, for the recipients a brand-new lead just
 *      fanned out to, seconds after submission. A latency optimisation,
 *      not a guarantee.
 *   2. The 15-minute sweep cron, for whatever is still due. This is the
 *      actual delivery guarantee -- it also re-drives anything the
 *      trigger's fire-and-forget pg_net call never got a response from.
 *
 * Both call sites are handled identically: claim_whatsapp_notifications
 * makes concurrent claims of the same row safe (whichever caller's
 * transaction wins the row proceeds; the other sees it locked and gets
 * nothing back), so this function never needs to know which path invoked
 * it.
 *
 * Auth: `auth: "secret"` means only a caller presenting a Supabase secret
 * key (the trigger and the sweep, via Vault -- see invoke_edge_function)
 * can reach this endpoint. It is never called by the browser.
 *
 * PREREQUISITE: WHATSAPP_TEMPLATE_NAME must already exist, be approved, and
 * have exactly 4 body placeholders (name, email, phone, message) in that
 * order -- see the README's WhatsApp setup section. A missing/unapproved
 * template fails every single notification identically (error code
 * 132001), so if every row is going `dead` with the same code, this is the
 * first thing to check.
 */

const MAX_NOTIFICATION_IDS = 50; // matches due_whatsapp_notification_ids' own batch size

function isValidRequest(body: unknown): body is WhatsappNotifyRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  const ids = b.notification_ids;
  if (b.dry_run !== undefined && typeof b.dry_run !== "boolean") return false;
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= MAX_NOTIFICATION_IDS &&
    ids.every((id) => typeof id === "number" && Number.isInteger(id))
  );
}

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = SupabaseClient<any, any, any>;

async function markSent(admin: SupabaseAdmin, notificationId: number, messageId: string) {
  const { error } = await admin
    .from("contact_lead_whatsapp_notifications")
    .update({ status: "sent", message_id: messageId, sent_at: new Date().toISOString(), last_error: null })
    .eq("id", notificationId);
  if (error) console.error(`[whatsapp-notify] failed to write back sent status for notification ${notificationId}:`, error.code);
}

async function markFailed(admin: SupabaseAdmin, notification: ClaimedWhatsappNotification, errorText: string) {
  const backoffMs = computeBackoffMinutes(notification.attempts) * 60_000;
  const { error } = await admin
    .from("contact_lead_whatsapp_notifications")
    .update({
      status: "failed",
      last_error: errorText,
      next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
    })
    .eq("id", notification.notification_id);
  if (error) console.error(`[whatsapp-notify] failed to write back failed status for notification ${notification.notification_id}:`, error.code);
}

async function markDead(admin: SupabaseAdmin, notificationId: number, errorText: string) {
  const { error } = await admin
    .from("contact_lead_whatsapp_notifications")
    .update({ status: "dead", last_error: errorText })
    .eq("id", notificationId);
  if (error) console.error(`[whatsapp-notify] failed to write back dead status for notification ${notificationId}:`, error.code);
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    if (!isValidRequest(body)) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const result: WhatsappNotifyResponse = { claimed: 0, sent: 0, failed: 0, dead: 0 };

    const admin = ctx.supabaseAdmin as SupabaseAdmin;

    const { data: claimed, error: claimError } = await admin.rpc("claim_whatsapp_notifications", {
      p_ids: body.notification_ids,
    });

    if (claimError) {
      console.error("[whatsapp-notify] claim_whatsapp_notifications failed:", claimError.code);
      return Response.json({ error: "claim_failed" }, { status: 500 });
    }

    const notifications = (claimed ?? []) as ClaimedWhatsappNotification[];
    result.claimed = notifications.length;
    if (notifications.length === 0) {
      // Everything requested was already claimed by the other path, or
      // wasn't actually due yet -- not an error.
      return Response.json(result);
    }

    const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
    const apiVersion = optionalEnv("WHATSAPP_API_VERSION") ?? "v23.0";
    const templateName = requireEnv("WHATSAPP_TEMPLATE_NAME");
    const languageCode = optionalEnv("WHATSAPP_TEMPLATE_LANGUAGE") ?? "en_US";
    const dryRun = body.dry_run === true;
    const recipientOverride = optionalEnv("WHATSAPP_RECIPIENT_OVERRIDE");
    if (dryRun && !recipientOverride) {
      return Response.json({ error: "dry_run_misconfigured" }, { status: 500 });
    }
    const url = whatsappMessagesUrl(apiVersion, phoneNumberId);

    // Sequential by design: at the volume this project expects (a handful
    // of leads a day, each fanning out to a short recipient list), there is
    // no reason to risk bursting WhatsApp's per-second rate limit for
    // marginal speed. Revisit if the recipient list or lead volume grows
    // enough for this loop to become the bottleneck.
    for (const notification of notifications) {
      const to = dryRun ? (recipientOverride as string) : notification.phone_number;
      const requestBody = buildTemplateMessageBody({
        templateName,
        languageCode,
        to,
        name: notification.name,
        email: notification.email,
        phone: notification.phone,
        message: notification.message,
      });

      let status: number;
      let responseBody: unknown;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(15_000),
        });
        status = response.status;
        responseBody = await response.json().catch(() => null);
      } catch (err) {
        // Network error or timeout -- classified the same as a 5xx: retryable.
        status = 599;
        responseBody = { error: { message: (err as Error).message } };
      }

      const errorInfo = extractWhatsappError(status, responseBody);
      const outcome = classifyWhatsappStatus(status, errorInfo.code);

      if (outcome === "sent") {
        const rawMessages = (responseBody as Record<string, unknown> | null)?.messages;
        const messageId = Array.isArray(rawMessages) && typeof rawMessages[0]?.id === "string"
          ? rawMessages[0].id
          : null;
        if (messageId) {
          await markSent(admin, notification.notification_id, messageId);
          result.sent += 1;
        } else {
          // 2xx with no message id is not a shape we expect -- don't claim
          // success for a lead that may not have actually been delivered.
          await markFailed(admin, notification, formatErrorForStorage({ status, message: "2xx response missing messages[0].id" }));
          result.failed += 1;
        }
      } else if (outcome === "dead") {
        await markDead(admin, notification.notification_id, formatErrorForStorage(errorInfo));
        result.dead += 1;
      } else {
        await markFailed(admin, notification, formatErrorForStorage(errorInfo));
        result.failed += 1;
      }
    }

    return Response.json(result);
  }),
};
