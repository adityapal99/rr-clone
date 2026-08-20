import { defineRouting } from "next-intl/routing";

/**
 * Central i18n configuration.
 *
 * `en` (English) is the default/source locale, `ar` (Arabic, UAE market)
 * is provided as the business operates out of Ajman, UAE. Add further
 * locales here and drop a matching file into /messages to extend.
 */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

/** Locales that read right-to-left. */
export const rtlLocales: readonly AppLocale[] = ["ar"];

export function isRtlLocale(locale: string): boolean {
  return (rtlLocales as readonly string[]).includes(locale);
}
