import { assertEquals } from "@std/assert";
import {
  buildTemplateMessageBody,
  classifyWhatsappStatus,
  computeBackoffMinutes,
  extractWhatsappError,
  formatErrorForStorage,
  sanitizeTemplateParam,
  whatsappMessagesUrl,
  type LeadNotificationInput,
} from "./whatsapp.ts";

function makeInput(overrides: Partial<LeadNotificationInput> = {}): LeadNotificationInput {
  return {
    templateName: "new_lead_notification",
    languageCode: "en_US",
    to: "+971500000000",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+971500000001",
    message: "Interested in a bulk order.",
    ...overrides,
  };
}

// --- whatsappMessagesUrl ---------------------------------------------------

Deno.test("whatsappMessagesUrl: builds the versioned Graph API endpoint", () => {
  assertEquals(
    whatsappMessagesUrl("v25.0", "106540352242922"),
    "https://graph.facebook.com/v25.0/106540352242922/messages",
  );
});

// --- sanitizeTemplateParam --------------------------------------------------

Deno.test("sanitizeTemplateParam: leaves ordinary text untouched", () => {
  assertEquals(sanitizeTemplateParam("Interested in a bulk order."), "Interested in a bulk order.");
});

Deno.test("sanitizeTemplateParam: replaces newlines and tabs with a space", () => {
  assertEquals(sanitizeTemplateParam("line one\nline two\ttabbed"), "line one line two tabbed");
});

Deno.test("sanitizeTemplateParam: collapses 4+ consecutive spaces (WhatsApp rejects these)", () => {
  assertEquals(sanitizeTemplateParam("a     b"), "a   b");
});

Deno.test("sanitizeTemplateParam: leaves up to 3 consecutive spaces alone", () => {
  assertEquals(sanitizeTemplateParam("a   b"), "a   b");
});

Deno.test("sanitizeTemplateParam: trims surrounding whitespace", () => {
  assertEquals(sanitizeTemplateParam("  hello  "), "hello");
});

Deno.test("sanitizeTemplateParam: truncates an oversized value with an ellipsis", () => {
  const result = sanitizeTemplateParam("x".repeat(400));
  assertEquals(result.length, 300);
  assertEquals(result.endsWith("…"), true);
});

// --- buildTemplateMessageBody -----------------------------------------------

Deno.test("buildTemplateMessageBody: builds the exact Cloud API template shape", () => {
  const body = buildTemplateMessageBody(makeInput());
  assertEquals(body, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "+971500000000",
    type: "template",
    template: {
      name: "new_lead_notification",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Jane Doe" },
            { type: "text", text: "jane@example.com" },
            { type: "text", text: "+971500000001" },
            { type: "text", text: "Interested in a bulk order." },
          ],
        },
      ],
    },
  });
});

Deno.test("buildTemplateMessageBody: substitutes an em-dash placeholder for a null phone", () => {
  const body = buildTemplateMessageBody(makeInput({ phone: null }));
  assertEquals(body.template.components[0].parameters[2].text, "—");
});

Deno.test("buildTemplateMessageBody: sanitizes a message containing a newline", () => {
  const body = buildTemplateMessageBody(makeInput({ message: "Line one\nLine two" }));
  assertEquals(body.template.components[0].parameters[3].text, "Line one Line two");
});

// --- classifyWhatsappStatus --------------------------------------------------

Deno.test("classifyWhatsappStatus: 2xx is sent", () => {
  assertEquals(classifyWhatsappStatus(200), "sent");
});

Deno.test("classifyWhatsappStatus: template issues are terminal", () => {
  assertEquals(classifyWhatsappStatus(400, 132001), "dead"); // template missing/unapproved
  assertEquals(classifyWhatsappStatus(400, 132000), "dead"); // parameter count mismatch
  assertEquals(classifyWhatsappStatus(400, 132015), "dead"); // paused for quality
  assertEquals(classifyWhatsappStatus(400, 132016), "dead"); // permanently disabled
});

Deno.test("classifyWhatsappStatus: recipient/number issues are terminal", () => {
  assertEquals(classifyWhatsappStatus(400, 131026), "dead"); // not a WhatsApp number
  assertEquals(classifyWhatsappStatus(400, 131021), "dead"); // sender == recipient
  assertEquals(classifyWhatsappStatus(400, 131037), "dead"); // display name issue
});

Deno.test("classifyWhatsappStatus: opted-out recipient is terminal", () => {
  assertEquals(classifyWhatsappStatus(400, 131050), "dead");
});

Deno.test("classifyWhatsappStatus: rate limits are retryable, not terminal", () => {
  assertEquals(classifyWhatsappStatus(429, 4), "failed");
  assertEquals(classifyWhatsappStatus(429, 80007), "failed");
  assertEquals(classifyWhatsappStatus(429, 130429), "failed");
});

Deno.test("classifyWhatsappStatus: auth errors are retryable (ride the cap into dead)", () => {
  assertEquals(classifyWhatsappStatus(401, 0), "failed");
  assertEquals(classifyWhatsappStatus(401, 190), "failed");
  assertEquals(classifyWhatsappStatus(403, 10), "failed");
});

Deno.test("classifyWhatsappStatus: an unrecognized error code is treated as retryable, not terminal", () => {
  assertEquals(classifyWhatsappStatus(400, 999999), "failed");
});

Deno.test("classifyWhatsappStatus: a missing error code (network error) is retryable", () => {
  assertEquals(classifyWhatsappStatus(599), "failed");
});

// --- extractWhatsappError / formatErrorForStorage ---------------------------

Deno.test("extractWhatsappError: reads code, subcode, message, and fbtrace_id", () => {
  const info = extractWhatsappError(400, {
    error: {
      message: "Template name does not exist",
      type: "OAuthException",
      code: 132001,
      error_subcode: 2494010,
      fbtrace_id: "Abc123XYZ",
    },
  });
  assertEquals(info.status, 400);
  assertEquals(info.code, 132001);
  assertEquals(info.subcode, 2494010);
  assertEquals(info.message, "Template name does not exist");
  assertEquals(info.fbtraceId, "Abc123XYZ");
});

Deno.test("extractWhatsappError: falls back gracefully on a non-object body", () => {
  const info = extractWhatsappError(503, "Service Unavailable");
  assertEquals(info.status, 503);
  assertEquals(info.message, "HTTP 503");
  assertEquals(info.code, undefined);
});

Deno.test("extractWhatsappError: truncates an oversized message", () => {
  const info = extractWhatsappError(400, { error: { message: "x".repeat(1000) } });
  assertEquals(info.message.length, 500);
});

Deno.test("formatErrorForStorage: includes code, subcode, and fbtrace_id when present", () => {
  const formatted = formatErrorForStorage({
    status: 400,
    code: 132001,
    subcode: 2494010,
    message: "Template name does not exist",
    fbtraceId: "Abc123XYZ",
  });
  assertEquals(formatted, "400 code=132001 subcode=2494010 Template name does not exist fbtrace_id=Abc123XYZ");
});

Deno.test("formatErrorForStorage: omits absent fields cleanly", () => {
  const formatted = formatErrorForStorage({ status: 500, message: "boom" });
  assertEquals(formatted, "500 boom");
});

// --- computeBackoffMinutes (identical contract to the pre-pivot HubSpot version) ---

Deno.test("computeBackoffMinutes: doubles each attempt and caps at 60", () => {
  assertEquals(computeBackoffMinutes(1), 2);
  assertEquals(computeBackoffMinutes(2), 4);
  assertEquals(computeBackoffMinutes(3), 8);
  assertEquals(computeBackoffMinutes(4), 16);
  assertEquals(computeBackoffMinutes(5), 32);
  assertEquals(computeBackoffMinutes(10), 60);
});
