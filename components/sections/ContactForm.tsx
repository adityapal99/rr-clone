"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";

type Status = "idle" | "submitting" | "success" | "error" | "rate-limited";

/**
 * Underlined field matching the site's hairline/uppercase-label aesthetic
 * (see Hero's CTA, ContactSection's own address/phone/email) rather than a
 * boxed input.
 */
function Field({
  id,
  label,
  type = "text",
  required,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2">
      <span className="text-[10px] tracking-[0.25em] text-rr-faint uppercase">
        {label}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        data-cursor="interactive"
        className="border-b border-rr-hairline bg-transparent pb-2 text-sm text-rr-ink outline-none transition-colors focus:border-rr-hairline-strong"
      />
    </label>
  );
}

function MessageField({
  id,
  label,
  required,
}: {
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2">
      <span className="text-[10px] tracking-[0.25em] text-rr-faint uppercase">
        {label}
      </span>
      <textarea
        id={id}
        name={id}
        rows={4}
        required={required}
        data-cursor="interactive"
        className="resize-none border-b border-rr-hairline bg-transparent pb-2 text-sm text-rr-ink outline-none transition-colors focus:border-rr-hairline-strong"
      />
    </label>
  );
}

function StatusMessage({ children, role }: { children: ReactNode; role: "status" | "alert" }) {
  return (
    <p role={role} className="text-xs tracking-[0.05em] text-rr-muted">
      {children}
    </p>
  );
}

/**
 * Honeypot field: a bot filling in every input on the page fills this one
 * too; a sighted, mouse/keyboard-using visitor never sees or tabs into it.
 * Offscreen (not `display:none`) because some bots skip display:none
 * fields, and NOT `required` -- browsers refuse to submit a form with a
 * hidden required field, which would silently break the form for everyone.
 * The route (app/api/contact/route.ts) treats a non-empty value here as a
 * bot and reports success without persisting anything.
 */
function HoneypotField() {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
      <label htmlFor="company">Company</label>
      <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

/**
 * Contact form: name, email, phone (optional), message. Posts to
 * `/api/contact` (see app/api/contact/route.ts), which persists into
 * Supabase, from where a trigger + cron sweep send a WhatsApp notification
 * and a daily job emails a spreadsheet of the previous day's leads.
 */
export function ContactForm() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      message: String(formData.get("message") ?? ""),
      locale,
      company: String(formData.get("company") ?? ""),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 429) {
        setStatus("rate-limited");
        return;
      }
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return <StatusMessage role="status">{t("form.success")}</StatusMessage>;
  }

  return (
    <form onSubmit={handleSubmit} noValidate={false} className="relative flex flex-col gap-6">
      <HoneypotField />

      <Field id="name" label={t("form.nameLabel")} required />
      <Field id="email" label={t("form.emailLabel")} type="email" required />
      <Field id="phone" label={t("form.phoneLabel")} type="tel" />
      <MessageField id="message" label={t("form.messageLabel")} required />

      <button
        type="submit"
        data-cursor="interactive"
        disabled={status === "submitting"}
        className="mt-2 self-start rounded-full border border-rr-hairline-strong bg-rr-ink/[0.06] px-8 py-3 text-xs tracking-[0.25em] uppercase transition-colors hover:bg-rr-ink hover:text-rr-black disabled:pointer-events-none disabled:opacity-50"
      >
        {status === "submitting" ? t("form.submitting") : t("form.submit")}
      </button>

      {status === "error" && <StatusMessage role="alert">{t("form.error")}</StatusMessage>}
      {status === "rate-limited" && (
        <StatusMessage role="alert">{t("form.tooManyRequests")}</StatusMessage>
      )}
    </form>
  );
}
