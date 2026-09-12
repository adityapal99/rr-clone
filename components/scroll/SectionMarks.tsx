"use client";

import { useTranslations } from "next-intl";
import { useScrollProgress } from "@/hooks/useScrollProgress";

/**
 * The numeral + tick mark for each section, laid out like the graduation
 * labels on a measuring tape.
 *
 * Real buttons, real labels, keyboard reachable — and the liquid-glass
 * cursor docks to them for free, since they're ordinary `button` elements.
 */
export function SectionMarks() {
  const { sections, activeIndex } = useScrollProgress();
  const tA11y = useTranslations("a11y");

  if (sections.length < 2) return null;

  // Dividing by `sections.length` (not `length - 1`) matches the
  // `--rail-progress` fix in ScrollProgressProvider: each mark sits at the
  // *start* of its section rather than the last mark landing exactly at
  // 100% a section early.
  return (
    <>
      {sections.map((section, index) => {
        const isActive = index === activeIndex;
        const top = `${(index / sections.length) * 100}%`;

        return (
          <button
            key={section.id}
            type="button"
            data-cursor="interactive"
            onClick={() => {
              document
                .getElementById(section.id)
                ?.scrollIntoView({ block: "start" });
            }}
            aria-label={tA11y("goToSection", { label: section.label })}
            aria-current={isActive ? "true" : undefined}
            className="pointer-events-auto absolute start-0 flex -translate-y-1/2 items-center gap-1.5 py-2 pe-1"
            style={{ top }}
          >
            <span
              dir="ltr"
              className={`text-[9px] tracking-[0.3em] tabular-nums transition-colors duration-500 ${
                isActive ? "text-rr-ink/90" : "text-white/30"
              }`}
            >
              {index}
            </span>
            <span
              className={`h-px w-2.5 transition-colors duration-500 ${
                isActive ? "bg-rr-ink/70" : "bg-white/20"
              }`}
            />
          </button>
        );
      })}
    </>
  );
}
