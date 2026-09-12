"use client";

import { useTranslations } from "next-intl";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { SectionMarks } from "./SectionMarks";

/**
 * Scroll progress as a tailor's measuring tape: uniform gradations down a
 * vertical strip, with the length already scrolled past reading bright
 * against the untouched remainder reading faint — as if the tape were being
 * pulled taut with the page. Fixed to the trailing edge, hidden below `md`.
 *
 * The gradations are one repeating background pattern drawn twice (see
 * `.tape-ticks`/`.tape-reveal` in globals.css) — the second copy clipped to
 * the fraction already scrolled via the `--rail-progress` custom property
 * ScrollProgressProvider writes every frame, so scrolling this never
 * re-renders React. `SectionMarks` supplies the numbered graduations at each
 * section boundary on top.
 */
export function ScrollProgressRail() {
  const tA11y = useTranslations("a11y");
  const { sections } = useScrollProgress();

  if (sections.length < 2) return null;

  return (
    <nav
      aria-label={tA11y("sectionNav")}
      className="pointer-events-none fixed end-0 top-1/2 z-30 hidden -translate-y-1/2 pe-4 md:block lg:pe-6"
    >
      <div className="relative h-[440px] w-16">
        <div className="absolute end-0 top-0 h-full w-7">
          <div aria-hidden className="tape-ticks absolute inset-0" />
          <div aria-hidden className="tape-ticks tape-reveal absolute inset-0" />
        </div>

        <SectionMarks />
      </div>
    </nav>
  );
}
