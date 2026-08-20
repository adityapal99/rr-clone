import { useTranslations } from "next-intl";
import { categories, logoImage, primaryNav } from "@/lib/content";

export function SiteFooter() {
  const tNav = useTranslations("nav");
  const tCategories = useTranslations("categories");
  const tFooter = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-rr-hairline bg-rr-black">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10">
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote vector wordmark */}
          <img
            src={logoImage.src}
            alt="Trends Garments"
            className="h-6 w-auto opacity-90 brightness-0 invert"
          />
        </div>

        <div className="mt-14 grid grid-cols-2 gap-10 border-t border-rr-hairline pt-10 sm:grid-cols-4">
          <nav aria-label={tNav("home")} className="flex flex-col gap-3">
            {primaryNav.map((item) => (
              <a
                key={item.key}
                href={item.href}
                data-cursor="interactive"
                className="text-[11px] tracking-[0.2em] text-rr-muted uppercase transition-colors hover:text-rr-ink"
              >
                {tNav(item.key)}
              </a>
            ))}
          </nav>

          <nav
            aria-label={tNav("products")}
            className="col-span-2 flex flex-col gap-3 sm:col-span-2"
          >
            {categories.map((category) => (
              <a
                key={category.id}
                href={category.href}
                data-cursor="interactive"
                className="text-[11px] tracking-[0.2em] text-rr-muted uppercase transition-colors hover:text-rr-ink"
              >
                {tCategories(`${category.id}.name`)}
              </a>
            ))}
          </nav>
        </div>

        <div
          dir="ltr"
          className="mt-14 border-t border-rr-hairline pt-8 text-center text-[11px] tracking-[0.15em] text-rr-faint"
        >
          {tFooter("legal", { year })}
        </div>
      </div>
    </footer>
  );
}
