import { describe, expect, it } from "vitest";
import { validateContactPayload } from "./validate";

describe("validateContactPayload", () => {
  const validBody = {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+971500000000",
    message: "Interested in a bulk order.",
    locale: "en",
    company: "",
  };

  it("accepts a fully valid payload", () => {
    const result = validateContactPayload(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(validBody);
    }
  });

  it("rejects a non-object body", () => {
    expect(validateContactPayload(null)).toEqual({ ok: false, error: "invalid_body" });
    expect(validateContactPayload("nope")).toEqual({ ok: false, error: "invalid_body" });
  });

  it("trims and lowercases the email", () => {
    const result = validateContactPayload({ ...validBody, email: "  Jane@Example.com  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe("jane@example.com");
  });

  it("rejects an empty name", () => {
    const result = validateContactPayload({ ...validBody, name: "   " });
    expect(result).toEqual({ ok: false, error: "name_required" });
  });

  it("rejects a name over 200 characters", () => {
    const result = validateContactPayload({ ...validBody, name: "a".repeat(201) });
    expect(result).toEqual({ ok: false, error: "name_too_long" });
  });

  it("accepts a name at exactly 200 characters", () => {
    const result = validateContactPayload({ ...validBody, name: "a".repeat(200) });
    expect(result.ok).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = validateContactPayload({ ...validBody, email: "not-an-email" });
    expect(result).toEqual({ ok: false, error: "email_invalid" });
  });

  it("rejects an email over 320 characters", () => {
    const longEmail = `${"a".repeat(316)}@x.co`; // 321 chars total
    const result = validateContactPayload({ ...validBody, email: longEmail });
    expect(result).toEqual({ ok: false, error: "email_too_long" });
  });

  it("accepts an email at exactly 320 characters", () => {
    const email = `${"a".repeat(315)}@x.co`; // 320 chars total
    const result = validateContactPayload({ ...validBody, email });
    expect(result.ok).toBe(true);
  });

  it("rejects a phone number over 40 characters", () => {
    const result = validateContactPayload({ ...validBody, phone: "1".repeat(41) });
    expect(result).toEqual({ ok: false, error: "phone_too_long" });
  });

  it("accepts an empty phone (it's optional)", () => {
    const result = validateContactPayload({ ...validBody, phone: "" });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty message", () => {
    const result = validateContactPayload({ ...validBody, message: "" });
    expect(result).toEqual({ ok: false, error: "message_required" });
  });

  it("rejects a message over 5000 characters", () => {
    const result = validateContactPayload({ ...validBody, message: "a".repeat(5001) });
    expect(result).toEqual({ ok: false, error: "message_too_long" });
  });

  it("accepts a message at exactly 5000 characters", () => {
    const result = validateContactPayload({ ...validBody, message: "a".repeat(5000) });
    expect(result.ok).toBe(true);
  });

  it("falls back to 'en' for an unsupported locale rather than erroring", () => {
    const result = validateContactPayload({ ...validBody, locale: "fr" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.locale).toBe("en");
  });

  it("accepts the 'ar' locale", () => {
    const result = validateContactPayload({ ...validBody, locale: "ar" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.locale).toBe("ar");
  });

  it("passes through a non-empty honeypot field untouched (the route decides what to do with it)", () => {
    const result = validateContactPayload({ ...validBody, company: "Acme Bots Inc" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.company).toBe("Acme Bots Inc");
  });

  it("treats missing fields as empty strings rather than throwing", () => {
    const result = validateContactPayload({ email: "jane@example.com" });
    expect(result).toEqual({ ok: false, error: "name_required" });
  });
});
