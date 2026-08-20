import Image from "next/image";
import { useTranslations } from "next-intl";
import { heroImage } from "@/lib/content";

export function Hero() {
  const t = useTranslations("hero");

  return (
    <section className="relative flex h-[100svh] min-h-[640px] w-full items-end overflow-hidden bg-rr-black">
      <Image
        src={heroImage.src}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-6 pb-24 text-center sm:pb-28">
        <h1 className="text-4xl leading-tight font-light tracking-[0.04em] uppercase sm:text-6xl md:text-7xl">
          {t("headline")}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed tracking-[0.08em] text-rr-muted uppercase sm:text-base">
          {t("subheadline")}
        </p>
        <a
          href="#about"
          data-cursor="interactive"
          className="mt-2 rounded-full border border-rr-hairline-strong bg-rr-ink/[0.06] px-8 py-3 text-xs tracking-[0.25em] uppercase transition-colors hover:bg-rr-ink hover:text-rr-black"
        >
          {t("cta")}
        </a>
      </div>
    </section>
  );
}
