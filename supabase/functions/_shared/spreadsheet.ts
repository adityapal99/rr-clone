/**
 * Pure spreadsheet-cell helpers, kept free of the write-excel-file
 * dependency so they can be unit tested in isolation (see
 * spreadsheet_test.ts) without pulling in the xlsx-writing library itself.
 * The actual workbook assembly lives in
 * daily-leads-report/workbook.ts.
 */

const DANGEROUS_LEADING_CHARS = new Set(["=", "+", "-", "@"]);

// C0 control characters, excluding tab (\x09), LF (\x0A) and CR (\x0D) --
// those three are legitimate whitespace a multi-line enquiry might contain
// and stripping them would mangle otherwise-normal message text. Also
// strips DEL (\x7F).
// deno-lint-ignore no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Defends a spreadsheet cell against formula/DDE injection.
 *
 * write-excel-file only emits a `type: 'Formula'` cell when explicitly
 * asked to (workbook.ts never does), so a plain string is written as
 * literal text, not evaluated as a formula, by the .xlsx format itself.
 * This function is a second, independent layer on top of that: it guards
 * against re-export to CSV (which has no cell-type metadata to protect it),
 * older Excel/DDE auto-execute quirks, and any other spreadsheet tool that
 * re-parses cell text by its leading character. Every string cell gets
 * this treatment -- name, email and phone are exactly as
 * attacker-controlled as message.
 */
export function sanitizeCell(value: string): string {
  const stripped = value.replace(CONTROL_CHARS_RE, "");
  if (stripped.length > 0 && DANGEROUS_LEADING_CHARS.has(stripped[0])) {
    return `'${stripped}`;
  }
  return stripped;
}

/**
 * "YYYY-MM-DD HH:mm" as read on a wall clock in `timeZone`, written as a
 * plain text cell rather than a native Date-type cell -- deliberately, so
 * there is no ambiguity about a spreadsheet application re-localizing a
 * date serial to the viewer's own timezone and defeating the entire point
 * of formatting it for a specific business timezone's report.
 *
 * Not hardcoded to one zone -- see _shared/config.ts for the one place the
 * business's actual reporting timezone is named.
 */
export function formatDateTimeInZone(isoString: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoString));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
