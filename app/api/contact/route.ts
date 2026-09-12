import { NextResponse } from "next/server";

interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidPayload(value: unknown): value is ContactPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    typeof v.email === "string" &&
    EMAIL_RE.test(v.email.trim()) &&
    typeof v.phone === "string" &&
    typeof v.message === "string" &&
    v.message.trim().length > 0
  );
}

/**
 * Contact form submission endpoint.
 *
 * Stub for now: validates the payload shape and reports receipt without
 * persisting anything. The plan is to swap the body of this handler for a
 * call into a Supabase function that appends each submission to a daily
 * Excel report, emailed out once a day — the form (ContactForm.tsx) posts
 * here unchanged either way, only this file's internals need to change.
 *
 * Deliberately does not log the submitted name/email/phone/message — those
 * are personal data, and this stub's console output is not an appropriate
 * place to hold it. Once the real Supabase integration lands, submissions
 * should be persisted there, not logged.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // TODO: replace with the real Supabase call that appends this submission
  // to the daily Excel report. No persistence happens yet.
  console.log("[contact] submission received (not yet persisted)");

  return NextResponse.json({ ok: true });
}
