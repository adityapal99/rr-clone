import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ScrollProgressRail } from "@/components/scroll/ScrollProgressRail";
import { PinnedSection } from "@/components/scroll/PinnedSection";
import { ScrollProgressProvider } from "@/components/scroll/ScrollProgressProvider";
import { ContactSection } from "@/components/sections/ContactSection";
import { ExploreGrid } from "@/components/sections/ExploreGrid";
import { Hero } from "@/components/sections/Hero";
import { SplitPanels } from "@/components/sections/SplitPanels";
import { StoryBlock } from "@/components/sections/StoryBlock";
import { STORY_ENTRIES } from "@/lib/content";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Each section is a `PinnedSection`: it holds in place while you keep
 * scrolling, and the measuring-tape rail shows how far along you are.
 * Section ids stay on the pinned tracks so the existing in-page anchors
 * (#services, #about, #products, #contact) still land correctly.
 *
 * The footer deliberately sits outside the provider's tracks, in normal
 * document flow, so the page has somewhere to come to rest.
 */
export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  return (
    <ScrollProgressProvider>
      <SiteHeader />
      <ScrollProgressRail />

      <main id="main-content">
        <PinnedSection id="hero" label={t("nav.home")} hold="short">
          <Hero />
        </PinnedSection>

        <PinnedSection id="services" label={t("panels.products.title")}>
          <SplitPanels />
        </PinnedSection>

        {/* Each block gets an opaque ground and a leading hairline. Without
            them, two consecutive text-only sections are both transparent, so
            the hand-off between them reads as a viewport of undifferentiated
            black instead of one panel sliding away beneath the next. The
            hairline also restores the divider these blocks carried before
            they were split apart. */}
        {STORY_ENTRIES.map((entry, index) => (
          <PinnedSection
            key={entry}
            id={index === 0 ? "about" : `about-${entry}`}
            label={t(`story.${entry}.title`)}
            className={`border-t border-rr-hairline ${
              index % 2 === 0 ? "bg-rr-black" : "bg-rr-panel"
            }`}
          >
            <StoryBlock entry={entry} index={index} />
          </PinnedSection>
        ))}

        <PinnedSection
          id="products"
          label={t("explore.heading")}
          className="border-t border-rr-hairline bg-rr-black"
        >
          <ExploreGrid />
        </PinnedSection>

        <PinnedSection
          id="contact"
          label={t("contact.heading")}
          hold="short"
          className="border-t border-rr-hairline bg-rr-panel"
        >
          <ContactSection />
        </PinnedSection>
      </main>

      <SiteFooter />
    </ScrollProgressProvider>
  );
}
