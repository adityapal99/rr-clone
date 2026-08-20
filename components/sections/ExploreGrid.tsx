import { useTranslations } from "next-intl";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Reveal } from "@/components/ui/Reveal";
import { categories } from "@/lib/content";

export function ExploreGrid() {
  const t = useTranslations("explore");
  const tCategories = useTranslations("categories");

  return (
    <section id="products" className="bg-rr-black py-24 sm:py-32">
      <Reveal className="mx-auto mb-16 max-w-3xl px-6 text-center">
        <span className="text-xs tracking-[0.3em] text-rr-faint uppercase">
          {t("eyebrow")}
        </span>
        <h2 className="mt-4 text-2xl font-light tracking-[0.08em] uppercase sm:text-3xl">
          {t("heading")}
        </h2>
      </Reveal>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-px bg-rr-hairline px-6 sm:grid-cols-2 sm:px-10 lg:grid-cols-5">
        {categories.map((category, i) => (
          <Reveal key={category.id} delay={i * 80}>
            <a
              href={category.href}
              data-cursor="interactive"
              className={`group relative flex h-72 flex-col justify-between overflow-hidden bg-gradient-to-b p-6 ${category.gradient}`}
            >
              <CategoryIcon
                id={category.icon}
                className="h-10 w-10 text-rr-ink/70 transition-transform duration-500 group-hover:scale-110"
              />
              <div>
                <span className="text-[10px] tracking-[0.25em] text-rr-faint uppercase">
                  {tCategories(`${category.id}.kicker`)}
                </span>
                <h3 className="mt-2 text-sm tracking-[0.1em] uppercase">
                  {tCategories(`${category.id}.name`)}
                </h3>
                <span className="mt-3 inline-block text-[10px] tracking-[0.2em] text-rr-muted uppercase opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {t("viewCollection")}
                </span>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
