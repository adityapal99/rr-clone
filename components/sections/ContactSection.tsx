import { useLocale, useTranslations } from "next-intl";
import { contactLinks } from "@/lib/content";
import { isRtlLocale } from "@/i18n/routing";
import { ContactForm } from "./ContactForm";

export function ContactSection() {
  const t = useTranslations("contact");
  const addressLines = t.raw("addressLines") as string[];
  // These links are pinned dir="ltr" so phone numbers/emails always read
  // left-to-right, even on the Arabic page — so their text-align has to
  // be driven by the actual page direction rather than Tailwind's
  // `rtl:`/`ltr:` variants, which key off of this same `dir` attribute.
  const numeralAlign = isRtlLocale(useLocale()) ? "text-right" : "text-left";

  return (
    <div className="pin-content w-full py-16 sm:py-24">
      <div className="mx-auto grid max-w-5xl gap-12 px-6 sm:grid-cols-2 sm:gap-16 sm:px-10">
        <div className="flex flex-col gap-10">
          <h2 className="text-xs tracking-[0.3em] text-rr-faint uppercase">
            {t("heading")}
          </h2>

          <div>
            <span className="text-[10px] tracking-[0.25em] text-rr-faint uppercase">
              {t("addressLabel")}
            </span>
            <address className="mt-3 text-sm leading-relaxed text-rr-muted not-italic">
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <span className="text-[10px] tracking-[0.25em] text-rr-faint uppercase">
                {t("phoneLabel")}
              </span>
              <a
                href={contactLinks.phoneHref}
                data-cursor="interactive"
                className={`mt-3 block text-sm text-rr-ink transition-colors hover:text-rr-muted ${numeralAlign}`}
                dir="ltr"
              >
                {t("phone")}
              </a>
            </div>
            <div>
              <span className="text-[10px] tracking-[0.25em] text-rr-faint uppercase">
                {t("emailLabel")}
              </span>
              <a
                href={contactLinks.emailHref}
                data-cursor="interactive"
                className={`mt-3 block text-sm text-rr-ink transition-colors hover:text-rr-muted ${numeralAlign}`}
                dir="ltr"
              >
                {t("email")}
              </a>
            </div>
          </div>
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
