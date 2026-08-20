import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";

const ENTRIES = ["precision", "brand", "manufacturing"] as const;

/**
 * The three craftsmanship narrative blocks, alternating alignment —
 * a text-forward, full-bleed-dark editorial break in the same spirit
 * as Rolls-Royce's "SERIES II" style copy-only moments.
 */
export function StoryList() {
  const t = useTranslations("story");

  return (
    <section id="about" className="bg-rr-black">
      {ENTRIES.map((key, i) => {
        const align = i % 2 === 0 ? "justify-start" : "justify-end";
        const textAlign = i % 2 === 0 ? "text-start" : "text-end";

        return (
          <div key={key} className="border-t border-rr-hairline">
            <div className={`mx-auto flex max-w-6xl px-6 py-24 sm:px-10 sm:py-32 ${align}`}>
              <Reveal className={`max-w-xl ${textAlign}`}>
                <span className="text-xs tracking-[0.3em] text-rr-faint">
                  {t(`${key}.index`)}
                </span>
                <h2 className="mt-4 text-2xl leading-snug font-light tracking-[0.06em] uppercase sm:text-4xl">
                  {t(`${key}.title`)}
                </h2>
                <p className="mt-6 text-sm leading-relaxed text-rr-muted sm:text-base">
                  {t(`${key}.body`)}
                </p>
              </Reveal>
            </div>
          </div>
        );
      })}
    </section>
  );
}
