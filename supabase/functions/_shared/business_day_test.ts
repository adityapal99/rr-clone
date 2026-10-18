import { assertEquals } from "@std/assert";
import { formatDateInZone, isValidIsoDate, yesterdayInZone } from "./business_day.ts";

// Asia/Dubai = UTC+04:00, no DST. Each case is a UTC instant chosen so the
// corresponding Dubai wall-clock time lands where the comment says --
// exactly the boundary-crossing instants a naive "subtract 24h then
// reformat" implementation gets wrong.

Deno.test("yesterdayInZone: ordinary evening, no boundary crossing", () => {
  // 2026-09-13 23:59 Dubai
  const now = new Date("2026-09-13T19:59:00Z");
  assertEquals(yesterdayInZone(now, "Asia/Dubai"), "2026-09-12");
});

Deno.test("yesterdayInZone: just after local midnight stays on the same UTC calendar day", () => {
  // 2026-09-13 00:30 Dubai (still 2026-09-12 in UTC)
  const now = new Date("2026-09-12T20:30:00Z");
  assertEquals(yesterdayInZone(now, "Asia/Dubai"), "2026-09-12");
});

Deno.test("yesterdayInZone: month rollover", () => {
  // 2026-10-01 00:15 Dubai
  const now = new Date("2026-09-30T20:15:00Z");
  assertEquals(yesterdayInZone(now, "Asia/Dubai"), "2026-09-30");
});

Deno.test("yesterdayInZone: year rollover", () => {
  // 2027-01-01 00:10 Dubai
  const now = new Date("2026-12-31T20:10:00Z");
  assertEquals(yesterdayInZone(now, "Asia/Dubai"), "2026-12-31");
});

Deno.test("yesterdayInZone: leap day (2028 is a leap year)", () => {
  // 2028-03-01 00:05 Dubai
  const now = new Date("2028-02-29T20:05:00Z");
  assertEquals(yesterdayInZone(now, "Asia/Dubai"), "2028-02-29");
});

Deno.test("yesterdayInZone: February in a non-leap year has 28 days", () => {
  // 2026-03-01 00:05 Dubai
  const now = new Date("2026-02-28T20:05:00Z");
  assertEquals(yesterdayInZone(now, "Asia/Dubai"), "2026-02-28");
});

Deno.test("yesterdayInZone: is genuinely parameterised, not hardcoded to one offset", () => {
  // 2026-09-13 00:30 IST (Asia/Kolkata, UTC+05:30) == 2026-09-12T19:00Z
  const now = new Date("2026-09-12T19:00:00Z");
  assertEquals(yesterdayInZone(now, "Asia/Kolkata"), "2026-09-12");
});

Deno.test("formatDateInZone: matches the wall-clock date, not the UTC date", () => {
  // 2026-09-13 02:00 Dubai == 2026-09-12 22:00 UTC -- different calendar days.
  assertEquals(formatDateInZone(new Date("2026-09-12T22:00:00Z"), "Asia/Dubai"), "2026-09-13");
});

Deno.test("isValidIsoDate: accepts a real calendar date", () => {
  assertEquals(isValidIsoDate("2026-09-12"), true);
});

Deno.test("isValidIsoDate: accepts Feb 29 in a leap year", () => {
  assertEquals(isValidIsoDate("2028-02-29"), true);
});

Deno.test("isValidIsoDate: rejects Feb 29 in a non-leap year", () => {
  assertEquals(isValidIsoDate("2026-02-29"), false);
});

Deno.test("isValidIsoDate: rejects an out-of-range month", () => {
  assertEquals(isValidIsoDate("2026-13-01"), false);
});

Deno.test("isValidIsoDate: rejects the wrong shape entirely", () => {
  assertEquals(isValidIsoDate("nonsense"), false);
  assertEquals(isValidIsoDate("2026/09/12"), false);
  assertEquals(isValidIsoDate(""), false);
});
