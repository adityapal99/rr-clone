"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

interface LocaleSwitcherProps {
  className?: string;
}

/** Swaps the active locale while preserving the current path. */
export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      className={`flex items-center gap-1 text-[11px] tracking-[0.2em] uppercase ${className ?? ""}`}
      role="group"
      aria-label={t("label")}
    >
      {routing.locales.map((loc, i) => (
        <div key={loc} className="flex items-center gap-1">
          {i > 0 && <span className="text-rr-faint">/</span>}
          <button
            type="button"
            data-cursor="interactive"
            onClick={() => router.replace(pathname, { locale: loc })}
            aria-pressed={loc === locale}
            className={`px-1 py-1 transition-colors ${
              loc === locale ? "text-rr-ink" : "text-rr-faint hover:text-rr-ink"
            }`}
          >
            {loc.toUpperCase()}
          </button>
        </div>
      ))}
    </div>
  );
}
