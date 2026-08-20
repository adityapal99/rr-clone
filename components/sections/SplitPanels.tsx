import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";

interface PanelProps {
  eyebrowIndex: string;
  title: string;
  cta: string;
  href: string;
  gradient: string;
}

function Panel({ eyebrowIndex, title, cta, href, gradient }: PanelProps) {
  return (
    <a
      href={href}
      data-cursor="interactive"
      className={`group relative flex h-[60vh] min-h-[420px] flex-1 flex-col justify-end overflow-hidden bg-gradient-to-br ${gradient} p-8 sm:p-12`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -end-10 text-[13rem] leading-none font-light text-rr-ink/[0.04] transition-transform duration-700 group-hover:scale-110 sm:text-[16rem]"
      >
        {eyebrowIndex}
      </span>

      <div className="relative border-s border-rr-hairline-strong ps-6">
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

export function SplitPanels() {
  const t = useTranslations("panels");

  return (
    <section id="services" className="bg-rr-black">
      <Reveal>
        <div className="flex flex-col sm:flex-row">
          <Panel
            eyebrowIndex="01"
            title={t("products.title")}
            cta={t("products.cta")}
            href="#products"
            gradient="from-[#171717] via-[#101010] to-black"
          />
          <Panel
            eyebrowIndex="02"
            title={t("services.title")}
            cta={t("services.cta")}
            href="#about"
            gradient="from-[#141414] via-[#0e0e0e] to-black"
          />
        </div>
      </Reveal>
    </section>
  );
}
