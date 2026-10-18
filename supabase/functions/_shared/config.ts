/**
 * Single source of truth for the business's reporting timezone. Used by
 * daily-leads-report (and its default "yesterday" calculation) and must
 * agree with the literal 'Asia/Dubai' passed to contact_leads_for_business_day
 * by the cron jobs in supabase/migrations/20261007173340_automation.sql --
 * SQL and Deno can't share a constant directly, so that file says so in a
 * comment pointing back here.
 *
 * Asia/Dubai is a fixed UTC+04:00 with no DST.
 */
export const REPORT_TIMEZONE = "Asia/Dubai";
