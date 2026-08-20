import type { routing } from "@/i18n/routing";
import type en from "./messages/en.json";

// Strongly types `useTranslations` / `getTranslations` keys and the
// `NextIntlClientProvider` messages prop against the English source catalog.
// Every other locale file (see /messages) must satisfy this same shape.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof en;
  }
}
