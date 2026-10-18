import { describe, expect, it } from "vitest";
import { getClientIp, hashForRateLimit } from "./rate-limit";

describe("getClientIp", () => {
  it("takes the first entry of x-forwarded-for, not the last", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("trims whitespace around the first entry", () => {
    const headers = new Headers({ "x-forwarded-for": "  1.2.3.4  , 10.0.0.1" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "5.6.7.8" });
    expect(getClientIp(headers)).toBe("5.6.7.8");
  });

  it("prefers x-forwarded-for over x-real-ip when both are present", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when neither header is present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("hashForRateLimit", () => {
  it("is deterministic for the same value and salt", () => {
    expect(hashForRateLimit("1.2.3.4", "salt")).toBe(hashForRateLimit("1.2.3.4", "salt"));
  });

  it("differs when the salt differs", () => {
    expect(hashForRateLimit("1.2.3.4", "salt-a")).not.toBe(hashForRateLimit("1.2.3.4", "salt-b"));
  });

  it("differs when the value differs", () => {
    expect(hashForRateLimit("1.2.3.4", "salt")).not.toBe(hashForRateLimit("5.6.7.8", "salt"));
  });

  it("never returns the raw input value", () => {
    expect(hashForRateLimit("jane@example.com", "salt")).not.toContain("jane@example.com");
  });

  it("produces a 64-character hex digest (sha256)", () => {
    expect(hashForRateLimit("x", "salt")).toMatch(/^[0-9a-f]{64}$/);
  });
});
