// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encodeBase64 } from "@std/encoding/base64";
import { isValidIsoDate, yesterdayInZone } from "../_shared/business_day.ts";
import { REPORT_TIMEZONE } from "../_shared/config.ts";
import { optionalEnv, requireEnv } from "../_shared/env.ts";
import { SendGridError, sendEmail } from "../_shared/sendgrid.ts";
import type { ContactLeadRow, DailyReportRequest, DailyReportResponse } from "../_shared/types.ts";
import { buildLeadsWorkbook } from "./workbook.ts";

/**
 * Emails a spreadsheet of the previous business day's contact-form leads to
 * every active report_recipients row. Called by two cron jobs (09:00 UAE
 * time, and an 11:00 UAE time retry that only fires if the morning run
 * never reached `sent` -- see
 * supabase/migrations/20261007173340_automation.sql), and safe to invoke by
 * hand for a specific date (see the README's runbook).
 *
 * report_runs is the durable idempotency layer: once a date's row is
 * `sent`, re-invoking for that date is a no-op. SendGrid itself has no
 * per-request idempotency key, so this table is the ONLY thing making a
 * manual re-run or the retry cron safe against a double-send.
 */

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = SupabaseClient<any, any, any>;

function isValidRequest(body: unknown): body is DailyReportRequest {
  if (body === null || body === undefined) return true; // both fields optional
  if (typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (b.report_date !== undefined && typeof b.report_date !== "string") return false;
  if (b.dry_run !== undefined && typeof b.dry_run !== "boolean") return false;
  return true;
}

interface ReportRun {
  report_date: string;
  status: "pending" | "sent" | "failed";
}

async function getExistingRun(admin: SupabaseAdmin, reportDate: string): Promise<ReportRun | null> {
  const { data, error } = await admin
    .from("report_runs")
    .select("report_date, status")
    .eq("report_date", reportDate)
    .maybeSingle();
  if (error) {
    console.error("[daily-leads-report] failed to read report_runs:", error.code);
    return null;
  }
  return data as ReportRun | null;
}

async function upsertRun(admin: SupabaseAdmin, reportDate: string, fields: Record<string, unknown>) {
  const { error } = await admin
    .from("report_runs")
    .upsert({ report_date: reportDate, ...fields }, { onConflict: "report_date" });
  if (error) {
    console.error(`[daily-leads-report] failed to write report_runs for ${reportDate}:`, error.code);
  }
}

async function getActiveRecipientEmails(admin: SupabaseAdmin): Promise<string[]> {
  const { data, error } = await admin
    .from("report_recipients")
    .select("email")
    .eq("is_active", true);
  if (error) {
    console.error("[daily-leads-report] failed to read report_recipients:", error.code);
    return [];
  }
  return ((data ?? []) as Array<{ email: string }>).map((row) => row.email);
}

function buildSubject(reportDate: string, leadCount: number): string {
  if (leadCount === 0) {
    return `Contact leads — ${reportDate} (UAE time) — none`;
  }
  return `Contact leads — ${reportDate} (UAE time) — ${leadCount} lead${leadCount === 1 ? "" : "s"}`;
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    let rawBody: unknown = null;
    const text = await req.text();
    if (text.length > 0) {
      try {
        rawBody = JSON.parse(text);
      } catch {
        return Response.json({ error: "invalid_body" }, { status: 400 });
      }
    }

    if (!isValidRequest(rawBody)) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const input = (rawBody ?? {}) as DailyReportRequest;

    const reportDate = input.report_date ?? yesterdayInZone(new Date(), REPORT_TIMEZONE);
    if (!isValidIsoDate(reportDate)) {
      return Response.json({ error: "invalid_report_date" }, { status: 400 });
    }

    const admin = ctx.supabaseAdmin as SupabaseAdmin;

    const existing = await getExistingRun(admin, reportDate);
    if (existing?.status === "sent") {
      const skipped: DailyReportResponse = {
        report_date: reportDate,
        lead_count: 0,
        recipient_count: 0,
        provider_message_id: null,
        skipped: true,
      };
      return Response.json(skipped);
    }

    await upsertRun(admin, reportDate, { status: "pending" });

    const { data: leadsData, error: leadsError } = await admin.rpc("contact_leads_for_business_day", {
      p_day: reportDate,
      p_timezone: REPORT_TIMEZONE,
    });

    if (leadsError) {
      console.error("[daily-leads-report] contact_leads_for_business_day failed:", leadsError.code);
      await upsertRun(admin, reportDate, { status: "failed", last_error: `query: ${leadsError.code}` });
      return Response.json({ error: "query_failed" }, { status: 500 });
    }

    const leads = (leadsData ?? []) as ContactLeadRow[];

    const dryRun = input.dry_run === true;
    const recipientOverride = optionalEnv("REPORT_RECIPIENT_OVERRIDE");
    if (dryRun && !recipientOverride) {
      await upsertRun(admin, reportDate, {
        status: "failed",
        last_error: "dry_run requested but REPORT_RECIPIENT_OVERRIDE is not set",
      });
      return Response.json({ error: "dry_run_misconfigured" }, { status: 500 });
    }

    const recipients = dryRun ? [recipientOverride as string] : await getActiveRecipientEmails(admin);
    if (recipients.length === 0) {
      const message = "no active report_recipients rows -- nothing to send to";
      console.error(`[daily-leads-report] ${message}`);
      await upsertRun(admin, reportDate, { status: "failed", last_error: message });
      return Response.json({ error: "no_recipients" }, { status: 500 });
    }

    const from = requireEnv("REPORT_FROM_EMAIL");
    const sendgridApiKey = requireEnv("SENDGRID_API_KEY");
    const subject = buildSubject(reportDate, leads.length);

    try {
      let messageId: string | null;

      if (leads.length === 0) {
        const sent = await sendEmail({
          apiKey: sendgridApiKey,
          from,
          toRecipients: recipients,
          subject,
          text: `No contact-form leads were recorded for ${reportDate} (UAE time).`,
        });
        messageId = sent.messageId;
      } else {
        const bytes = await buildLeadsWorkbook(leads);
        const sent = await sendEmail({
          apiKey: sendgridApiKey,
          from,
          toRecipients: recipients,
          subject,
          text:
            `${leads.length} contact-form lead${leads.length === 1 ? "" : "s"} for ${reportDate} (UAE time). ` +
            `See the attached spreadsheet.`,
          attachments: [
            {
              filename: `contact-leads-${reportDate}.xlsx`,
              content: encodeBase64(bytes),
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ],
        });
        messageId = sent.messageId;
      }

      await upsertRun(admin, reportDate, {
        status: "sent",
        lead_count: leads.length,
        recipient_count: recipients.length,
        provider_message_id: messageId,
        last_error: null,
      });

      const result: DailyReportResponse = {
        report_date: reportDate,
        lead_count: leads.length,
        recipient_count: recipients.length,
        provider_message_id: messageId,
        skipped: false,
      };
      return Response.json(result);
    } catch (err) {
      const message = err instanceof SendGridError ? `sendgrid ${err.status}: ${err.message}` : (err as Error).message;
      console.error(`[daily-leads-report] send failed for ${reportDate}:`, message);
      await upsertRun(admin, reportDate, { status: "failed", last_error: message.slice(0, 500) });
      // Non-2xx so a human curling this function sees the failure, and so
      // the 11:00 UAE time retry job (which checks report_runs.status =
      // 'sent') picks this date back up.
      return Response.json({ error: "send_failed" }, { status: 500 });
    }
  }),
};
