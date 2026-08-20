import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ContactSection } from "@/components/sections/ContactSection";
import { ExploreGrid } from "@/components/sections/ExploreGrid";
import { Hero } from "@/components/sections/Hero";
import { SplitPanels } from "@/components/sections/SplitPanels";
import { StoryList } from "@/components/sections/StoryList";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <SplitPanels />
        <StoryList />
        <ExploreGrid />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
