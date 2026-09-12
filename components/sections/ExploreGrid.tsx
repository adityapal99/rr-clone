import Image from "next/image";
import { useTranslations } from "next-intl";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { categories } from "@/lib/content";

/**
 * The collections line-up. Sizing is deliberately tight because this lives
 * in a pinned, viewport-height section: five tiles are one row at `lg` but
 * three rows at `sm` and five stacked on mobile, so tile height and the
 * heading's margin scale down below `lg` to keep the whole thing inside
 * 100svh without internal scrolling.
 */
export function ExploreGrid() {
  const t = useTranslations("explore");
  const tCategories = useTranslations("categories");

  return (
    <div className="pin-content w-full">
      <div className="mx-auto mb-8 max-w-3xl px-6 text-center lg:mb-14">
        <span className="text-xs tracking-[0.3em] text-rr-faint uppercase">
          {t("eyebrow")}
        </span>
        <h2 className="mt-3 text-xl font-light tracking-[0.08em] uppercase sm:text-2xl lg:text-3xl">
          {t("heading")}
        </h2>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-rr-hairline px-6 sm:px-10 lg:grid-cols-5">
        {categories.map((category) => (
          <a
            key={category.id}
            href={category.href}
            data-cursor="interactive"
            className="group relative flex h-32 flex-col justify-between overflow-hidden p-4 last:col-span-2 sm:h-40 sm:p-5 lg:h-72 lg:p-6 lg:last:col-span-1"
          >
            <Image
              src={category.image.src}
              alt=""
              fill
              sizes="(min-width:1024px) 20vw, (min-width:640px) 50vw, 50vw"
              loading="lazy"
              className="object-cover contrast-125 brightness-75"
            />
            <div
              aria-hidden
              className={`absolute inset-0 bg-gradient-to-b opacity-75 ${category.gradient}`}
            />

            <CategoryIcon
              id={category.icon}
              className="relative h-7 w-7 text-rr-ink/70 transition-transform duration-500 group-hover:scale-110 lg:h-10 lg:w-10"
            />
            <div className="relative">
              <span className="text-[10px] tracking-[0.25em] text-rr-faint uppercase">
                {tCategories(`${category.id}.kicker`)}
              </span>
              <h3 className="mt-1.5 text-xs tracking-[0.1em] uppercase sm:text-sm">
                {tCategories(`${category.id}.name`)}
              </h3>
              <span className="mt-2 hidden text-[10px] tracking-[0.2em] text-rr-muted uppercase opacity-0 transition-opacity duration-300 group-hover:opacity-100 lg:mt-3 lg:inline-block">
                {t("viewCollection")}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
