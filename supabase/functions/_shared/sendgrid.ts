/**
 * Minimal SendGrid v3 Mail Send client -- just what daily-leads-report
 * needs. Not unit tested (it's a thin fetch wrapper with nothing pure to
 * assert on); exercised for real via the README's runbook.
 */

export interface SendGridAttachment {
  filename: string;
  /** Base64-encoded file content. */
  content: string;
  type?: string;
  disposition?: "attachment" | "inline";
}

export interface SendEmailInput {
  apiKey: string;
  from: string;
  /**
   * One personalization per recipient, each with its own `to` -- so
   * multiple report_recipients rows receive the same email in a single API
   * call without seeing each other's address (unlike a shared `to` list).
   */
  toRecipients: string[];
  subject: string;
  text: string;
  attachments?: SendGridAttachment[];
}

export class SendGridError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "SendGridError";
  }
}

export interface SendEmailResult {
  /** From the X-Message-Id response header. SendGrid's v3 mail/send returns
   * a 202 with an empty body -- there is no id in the JSON response. */
  messageId: string | null;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const body: Record<string, unknown> = {
    personalizations: input.toRecipients.map((email) => ({ to: [{ email }] })),
    from: { email: input.from },
    subject: input.subject,
    content: [{ type: "text/plain", value: input.text }],
  };
  if (input.attachments && input.attachments.length > 0) {
    body.attachments = input.attachments;
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status !== 202) {
    const text = await response.text().catch(() => "");
    throw new SendGridError(response.status, text.slice(0, 500));
  }

  return { messageId: response.headers.get("X-Message-Id") };
}
