import { useLocale, useTranslations } from "next-intl";
import { categories, contactLinks, logoImage, primaryNav } from "@/lib/content";
import { isRtlLocale } from "@/i18n/routing";

export function SiteFooter() {
  const tNav = useTranslations("nav");
  const tCategories = useTranslations("categories");
  const tContact = useTranslations("contact");
  const tFooter = useTranslations("footer");
  const year = new Date().getFullYear();
  const addressLines = tContact.raw("addressLines") as string[];
  // Same reasoning as ContactSection: pin phone/email dir="ltr" so the
  // numerals/address always read left-to-right, with text-align following
  // the actual page direction instead of Tailwind's rtl:/ltr: variants.
  const numeralAlign = isRtlLocale(useLocale()) ? "text-right" : "text-left";

  return (
    <footer className="border-t border-rr-hairline bg-rr-black">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10">
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote vector wordmark */}
          <img
            src={logoImage.src}
            alt="Trends Garments"
            className="h-6 w-auto opacity-90 brightness-0 invert"
          />
        </div>

        <div className="mt-14 grid grid-cols-2 gap-10 border-t border-rr-hairline pt-10 sm:grid-cols-4">
          <nav aria-label={tNav("home")} className="flex flex-col gap-3">
            {primaryNav.map((item) => (
              <a
                key={item.key}
                href={item.href}
                data-cursor="interactive"
                className="text-[11px] tracking-[0.2em] text-rr-muted uppercase transition-colors hover:text-rr-ink"
              >
                {tNav(item.key)}
              </a>
            ))}
          </nav>

          <nav
            aria-label={tNav("products")}
            className="col-span-2 flex flex-col gap-3 sm:col-span-2"
          >
            {categories.map((category) => (
              <a
                key={category.id}
                href={category.href}
                data-cursor="interactive"
                className="text-[11px] tracking-[0.2em] text-rr-muted uppercase transition-colors hover:text-rr-ink"
              >
                {tCategories(`${category.id}.name`)}
              </a>
            ))}
          </nav>

          <div className="col-span-2 flex flex-col gap-4 sm:col-span-1">
            <div>
              <span className="text-[11px] tracking-[0.2em] text-rr-faint uppercase">
                {tContact("addressLabel")}
              </span>
              <address className="mt-2 text-[11px] leading-relaxed text-rr-muted not-italic">
                {addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </div>
            <div className="flex flex-col gap-1.5">
              <a
                href={contactLinks.phoneHref}
                data-cursor="interactive"
                dir="ltr"
                className={`text-[11px] text-rr-muted transition-colors hover:text-rr-ink ${numeralAlign}`}
              >
                {tContact("phone")}
              </a>
              <a
                href={contactLinks.emailHref}
                data-cursor="interactive"
                dir="ltr"
                className={`text-[11px] text-rr-muted transition-colors hover:text-rr-ink ${numeralAlign}`}
              >
                {tContact("email")}
              </a>
            </div>
          </div>
        </div>

        <div
          dir="ltr"
          className="mt-14 border-t border-rr-hairline pt-8 text-center text-[11px] tracking-[0.15em] text-rr-faint"
        >
          {tFooter("legal", { year })}
        </div>
      </div>
    </footer>
  );
}
