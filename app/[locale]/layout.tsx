import type { Metadata } from "next";
import { Jost } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LiquidGlassCursor } from "@/components/cursor/LiquidGlassCursor";
import { isRtlLocale, routing } from "@/i18n/routing";
import "../globals.css";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
    metadataBase: new URL("https://www.trendsgarments.com"),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `/${locale}`]),
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={isRtlLocale(locale) ? "rtl" : "ltr"}
      className={`${jost.variable} h-full antialiased`}
      // Browser extensions (password managers, Grammarly, automation tools,
      // etc.) commonly inject attributes onto <html> before React hydrates.
      // That's a client-side-only change React can never predict from the
      // server render, so it's the documented use case for this escape
      // hatch — see https://react.dev/link/hydration-mismatch.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-rr-black text-rr-ink">
        <NextIntlClientProvider>
          <LiquidGlassCursor />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
