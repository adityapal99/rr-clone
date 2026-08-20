"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { isRtlLocale } from "@/i18n/routing";
import { categories, contactLinks, primaryNav } from "@/lib/content";
import { LocaleSwitcher } from "./LocaleSwitcher";

interface NavOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Fullscreen navigation panel in the Rolls-Royce mould: a primary link
 * column paired with a secondary "collections" column, over a near-opaque
 * ground. Locks body scroll while open and closes on Escape.
 */
export function NavOverlay({ open, onClose }: NavOverlayProps) {
  const tNav = useTranslations("nav");
  const tCategories = useTranslations("categories");
  const tContact = useTranslations("contact");
  const tA11y = useTranslations("a11y");
  // These two links are pinned dir="ltr" so the phone number/email always
  // read left-to-right; their text-align is driven by the actual page
  // direction rather than Tailwind's rtl:/ltr: variants, which key off of
  // this same overridden `dir` attribute.
  const numeralAlign = isRtlLocale(useLocale()) ? "text-right" : "text-left";

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      id="site-navigation"
      aria-hidden={!open}
      className={`fixed inset-0 z-40 bg-rr-black/[0.97] backdrop-blur transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        open
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
    >
      <div className="mx-auto flex h-full max-w-6xl flex-col justify-center gap-16 px-6 pt-20 pb-16 sm:flex-row sm:gap-24 sm:px-10">
        <nav aria-label={tA11y("primaryNav")} className="flex flex-col gap-6">
          <span className="text-xs tracking-[0.3em] text-rr-faint uppercase">
            {tNav("home")}
          </span>
          <ul className="flex flex-col gap-4">
            {primaryNav.map((item) => (
              <li key={item.key}>
                <a
                  href={item.href}
                  data-cursor="interactive"
                  onClick={onClose}
                  className="text-2xl font-light tracking-wide text-rr-ink/90 transition-colors hover:text-rr-ink sm:text-3xl"
                >
                  {tNav(item.key)}
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 border-t border-rr-hairline pt-8 text-sm text-rr-muted">
            <a
              href={contactLinks.phoneHref}
              data-cursor="interactive"
              dir="ltr"
              className={`hover:text-rr-ink ${numeralAlign}`}
            >
              {tContact("phone")}
            </a>
            <a
              href={contactLinks.emailHref}
              data-cursor="interactive"
              dir="ltr"
              className={`hover:text-rr-ink ${numeralAlign}`}
            >
              {tContact("email")}
            </a>
            <LocaleSwitcher className="pt-2" />
          </div>
        </nav>

        <nav aria-label={tA11y("collectionsNav")} className="flex flex-col gap-6">
          <span className="text-xs tracking-[0.3em] text-rr-faint uppercase">
            {tNav("products")}
          </span>
          <ul className="flex flex-col gap-4">
            {categories.map((category) => (
              <li key={category.id}>
                <a
                  href={category.href}
                  data-cursor="interactive"
                  onClick={onClose}
                  className="text-sm tracking-[0.15em] text-rr-muted uppercase transition-colors hover:text-rr-ink"
                >
                  {tCategories(`${category.id}.name`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
