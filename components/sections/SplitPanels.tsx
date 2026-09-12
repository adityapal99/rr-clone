import Image from "next/image";
import { useTranslations } from "next-intl";
import { splitPanelImages, type ImageAsset } from "@/lib/content";

interface PanelProps {
  eyebrowIndex: string;
  title: string;
  cta: string;
  href: string;
  gradient: string;
  image: ImageAsset;
}

function Panel({ eyebrowIndex, title, cta, href, gradient, image }: PanelProps) {
  return (
    <a
      href={href}
      data-cursor="interactive"
      className="group relative flex h-1/2 flex-1 flex-col justify-end overflow-hidden p-8 sm:h-full sm:p-12"
    >
      <Image
        src={image.src}
        alt=""
        fill
        sizes="(min-width: 640px) 50vw, 100vw"
        loading="lazy"
        className="object-cover contrast-125 brightness-90"
      />
      <div aria-hidden className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-80`} />

      <span
        aria-hidden
        className="pin-counter pointer-events-none absolute -top-10 -end-10 text-[13rem] leading-none font-light text-rr-ink/[0.04] transition-transform duration-700 group-hover:scale-110 sm:text-[16rem]"
      >
        {eyebrowIndex}
      </span>

      <div className="pin-content relative border-s border-rr-hairline-strong ps-6">
        <h3 className="text-lg tracking-[0.15em] uppercase sm:text-xl">
          {title}
        </h3>
        <span className="mt-3 inline-flex items-center gap-2 text-xs tracking-[0.25em] text-rr-muted uppercase transition-colors group-hover:text-rr-ink">
          {cta}
          <span aria-hidden className="rtl:-scale-x-100">
            →
          </span>
        </span>
      </div>
    </a>
  );
}

/**
 * The paired "Crafted Collections" / "Tailored Solutions" panels, side by
 * side on desktop and stacked into two halves of the viewport on mobile so
 * the pair always fills exactly one pinned section.
 */
export function SplitPanels() {
  const t = useTranslations("panels");

  return (
    <div className="absolute inset-0 flex flex-col bg-rr-black sm:flex-row">
      <Panel
        eyebrowIndex="01"
        title={t("products.title")}
        cta={t("products.cta")}
        href="#products"
        gradient="from-[#171717] via-[#101010] to-black"
        image={splitPanelImages.products}
      />
      <Panel
        eyebrowIndex="02"
        title={t("services.title")}
        cta={t("services.cta")}
        href="#about"
        gradient="from-[#141414] via-[#0e0e0e] to-black"
        image={splitPanelImages.services}
      />
    </div>
  );
}
