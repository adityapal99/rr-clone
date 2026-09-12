"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { heroImage, heroVideo } from "@/lib/content";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSlowConnection } from "@/hooks/useSlowConnection";

export function Hero() {
  const t = useTranslations("hero");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const slowConnection = useSlowConnection();
  // Must start false to match the server render (no `document` there) —
  // a lazy initializer that checks `document.readyState` would return true
  // on the client's very first (hydration) render whenever the page had
  // already finished loading by then, mismatching the server's video-less
  // HTML. Effects only ever run after that first commit, so doing the
  // check here is already hydration-safe; the setTimeout only defers the
  // *state update* itself out of the effect's synchronous body, which is
  // what the lint rule below is actually asking for.
  const [pageLoaded, setPageLoaded] = useState(false);

  useEffect(() => {
    if (document.readyState === "complete") {
      const id = window.setTimeout(() => setPageLoaded(true), 0);
      return () => window.clearTimeout(id);
    }
    const onLoad = () => setPageLoaded(true);
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Skip the ~4MB video on a slow/metered connection or reduced motion — the
  // poster below already carries the same shot. Even when eligible, wait for
  // the page's own `load` event first, so the fetch never competes with the
  // critical path (JS/CSS/fonts/the poster itself) on any connection.
  const showVideo = pageLoaded && !reducedMotion && !slowConnection;

  return (
    <div className="absolute inset-0 flex items-end overflow-hidden bg-rr-black">
      {/* Guaranteed-visible base layer: the LCP candidate, and the fallback
          whenever the video is skipped or hasn't mounted yet. */}
      <Image
        src={heroImage.src}
        alt=""
        fill
        preload
        sizes="100vw"
        className="object-cover contrast-125 brightness-90"
      />
      {showVideo && (
        <video
          className="absolute inset-0 h-full w-full object-cover contrast-125 brightness-90"
          poster={heroImage.src}
          muted
          loop
          playsInline
          autoPlay
          aria-hidden="true"
        >
          <source src={heroVideo.src} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />

      <div className="pin-content relative mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 pb-20 text-center sm:gap-8 sm:pb-28">
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
    </div>
  );
}
