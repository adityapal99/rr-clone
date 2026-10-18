import { assertEquals } from "@std/assert";
import { formatDateTimeInZone, sanitizeCell } from "./spreadsheet.ts";

// --- sanitizeCell ---------------------------------------------------------

Deno.test("sanitizeCell: leaves ordinary text untouched", () => {
  assertEquals(sanitizeCell("Interested in a bulk order."), "Interested in a bulk order.");
});

Deno.test("sanitizeCell: quote-prefixes a leading equals sign", () => {
  assertEquals(sanitizeCell("=HYPERLINK(\"http://evil\")"), "'=HYPERLINK(\"http://evil\")");
});

Deno.test("sanitizeCell: quote-prefixes a leading plus, minus, or at-sign", () => {
  assertEquals(sanitizeCell("+1234"), "'+1234");
  assertEquals(sanitizeCell("-cmd|calc"), "'-cmd|calc");
  assertEquals(sanitizeCell("@SUM(A1)"), "'@SUM(A1)");
});

Deno.test("sanitizeCell: a dangerous character mid-string is left alone", () => {
  assertEquals(sanitizeCell("Price is =100"), "Price is =100");
});

Deno.test("sanitizeCell: strips non-whitespace control characters", () => {
  assertEquals(sanitizeCell("a\x00b\x1Fc"), "abc");
});

Deno.test("sanitizeCell: preserves tab, newline, and carriage return", () => {
  assertEquals(sanitizeCell("line one\nline two\ttabbed"), "line one\nline two\ttabbed");
});

Deno.test("sanitizeCell: empty string is returned as-is", () => {
  assertEquals(sanitizeCell(""), "");
});

// --- formatDateTimeInZone --------------------------------------------------

Deno.test("formatDateTimeInZone: converts a UTC instant to Dubai wall-clock time", () => {
  // 2026-09-12 21:30 UTC == 2026-09-13 01:30 Dubai (UTC+04:00)
  assertEquals(formatDateTimeInZone("2026-09-12T21:30:00Z", "Asia/Dubai"), "2026-09-13 01:30");
});

Deno.test("formatDateTimeInZone: pads single-digit month, day, hour, and minute", () => {
  // 2026-01-04 20:05 UTC == 2026-01-05 00:05 Dubai
  assertEquals(formatDateTimeInZone("2026-01-04T20:05:00Z", "Asia/Dubai"), "2026-01-05 00:05");
});

Deno.test("formatDateTimeInZone: is genuinely parameterised, not hardcoded to one offset", () => {
  // 2026-09-12 23:30 UTC == 2026-09-13 05:00 IST (Asia/Kolkata, UTC+05:30)
  assertEquals(formatDateTimeInZone("2026-09-12T23:30:00Z", "Asia/Kolkata"), "2026-09-13 05:00");
});
