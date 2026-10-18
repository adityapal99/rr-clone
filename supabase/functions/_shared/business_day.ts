/**
 * Timezone-parameterised day-boundary helpers for the daily report.
 *
 * The report's actual query window (the half-open range that decides which
 * rows belong to a given business day) is computed in SQL, in
 * contact_leads_for_business_day
 * (supabase/migrations/20261007173330_report_rpcs.sql) -- that is the one
 * place the boundary itself is defined, and it stays sargable against the
 * created_at index.
 *
 * This module only answers "what calendar date was 'yesterday' in a given
 * zone, right now" -- needed when a cron/manual invocation doesn't pass an
 * explicit report_date. Pure and deterministic given `now` and `timeZone`,
 * so it's testable without waiting for a real midnight, and not hardcoded
 * to any one timezone -- see _shared/config.ts for the one place the
 * business's actual zone is named.
 */

/** "YYYY-MM-DD" for `date` as read on a wall clock in `timeZone`. */
export function formatDateInZone(date: Date, timeZone: string): string {
  // en-CA renders as YYYY-MM-DD, which is exactly the ISO shape we want
  // without hand-assembling year/month/day parts ourselves.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * The calendar date immediately before "today in `timeZone`", as of `now`.
 *
 * Anchoring at 12:00 UTC before subtracting a day is the part that's easy
 * to get wrong: subtracting 24h from `now` directly and then reformatting
 * can land on the wrong side of the zone's UTC offset near a local
 * midnight, silently skipping or repeating a day. Anchoring at a fixed noon
 * UTC on today's local date keeps the subtraction entirely inside
 * daylight-safe territory, regardless of what wall-clock time `now`
 * actually is in `timeZone`.
 */
export function yesterdayInZone(now: Date, timeZone: string): string {
  const today = formatDateInZone(now, timeZone);
  const anchor = new Date(`${today}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - 1);
  return formatDateInZone(anchor, timeZone);
}

const DATE_SHAPE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Strict "YYYY-MM-DD" validation: right shape AND a real calendar date
 * (rejects 2026-13-40, 2026-02-30, etc.) -- a bad date silently reporting
 * on the wrong day is the worst failure mode for this function, so this is
 * checked before anything else runs. Timezone-agnostic by design.
 */
export function isValidIsoDate(input: string): boolean {
  if (!DATE_SHAPE_RE.test(input)) return false;

  const [year, month, day] = input.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
