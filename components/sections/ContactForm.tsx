"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

type Status = "idle" | "submitting" | "success" | "error";

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
 * A basic contact form: name, email, phone (optional), message. Posts to
 * `/api/contact` (see app/api/contact/route.ts) — that route is a stub for
 * now (validates + logs), meant to be swapped for a real Supabase call
 * later without this component needing to change at all.
 */
export function ContactForm() {
  const t = useTranslations("contact");
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
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
    <form onSubmit={handleSubmit} noValidate={false} className="flex flex-col gap-6">
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
    </form>
  );
}
