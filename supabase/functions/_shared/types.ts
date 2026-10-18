/**
 * Shapes shared between both Edge Functions. Mirrors the columns created in
 * supabase/migrations/20261007173236_contact_leads_table.sql and
 * 20261007173320_whatsapp_notifications.sql -- keep the two in sync by hand
 * (there is no codegen step in this project).
 */

export interface ContactLeadRow {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  locale: string;
}

export type WhatsappNotificationStatus = "pending" | "processing" | "sent" | "failed" | "dead";

/** One row of claim_whatsapp_notifications' return -- a notification fully
 * denormalised with its lead's and recipient's fields. */
export interface ClaimedWhatsappNotification {
  notification_id: number;
  lead_id: number;
  recipient_id: number;
  attempts: number;
  phone_number: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  locale: string;
  lead_created_at: string;
}

export interface WhatsappNotifyRequest {
  notification_ids: number[];
  /** Send to WHATSAPP_RECIPIENT_OVERRIDE instead of each claimed recipient's
   * real phone number. Only the trigger/sweep's internal calls omit this;
   * a manual test invocation sets it explicitly -- WHATSAPP_RECIPIENT_OVERRIDE
   * being set in the environment is NOT by itself enough to redirect real
   * notifications, specifically so that forgetting to unset it after testing
   * can't silently misroute production traffic. */
  dry_run?: boolean;
}

export interface WhatsappNotifyResponse {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
}

export interface DailyReportRequest {
  /** Business-day calendar date, "YYYY-MM-DD". Optional -- defaults to "yesterday" in REPORT_TIMEZONE. */
  report_date?: string;
  /** Send to REPORT_RECIPIENT_OVERRIDE instead of the report_recipients table. */
  dry_run?: boolean;
}

export interface DailyReportResponse {
  report_date: string;
  lead_count: number;
  recipient_count: number;
  provider_message_id: string | null;
  skipped: boolean;
}
