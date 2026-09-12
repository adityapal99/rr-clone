import type { ReactNode } from "react";

/** How long a section holds in place, as a multiple of the viewport. */
export type PinnedHold = "short" | "normal" | "tall";

const HOLD_CLASS: Record<PinnedHold, string> = {
  // The track is taller than the viewport; the surplus is how far you scroll
  // while the content stays pinned. `normal` gives one full viewport of hold.
  short: "h-[150svh]",
  normal: "h-[200svh]",
  tall: "h-[260svh]",
};

interface PinnedSectionProps {
  /** Anchor target. Goes on the outer track so jumps land with it pinned. */
  id: string;
  /** Already-translated label, read by the tape rail for its a11y text. */
  label: string;
  hold?: PinnedHold;
  children: ReactNode;
  /** Extra classes for the inner (pinned) viewport-sized element. */
  className?: string;
}

/**
 * A section that holds in place while you keep scrolling.
 *
 * Implemented as a tall track containing a `sticky` viewport-height child,
 * rather than by intercepting wheel events. That keeps scrolling on the
 * document, so `window.scrollY` stays truthful — which matters because
 * SiteHeader's expand-on-scroll reads it, Reveal's IntersectionObserver uses
 * the viewport as its root, and anchor links need real scroll positions.
 * Keyboard scrolling and the native scrollbar keep working for free.
 *
 * ScrollProgressProvider finds these via `[data-scroll-section]` and writes a
 * `--section-progress` custom property (0 → 1) onto the track, which section
 * internals can animate against in pure CSS.
 */
export function PinnedSection({
  id,
  label,
  hold = "normal",
  children,
  className,
}: PinnedSectionProps) {
  return (
    <section
      id={id}
      data-scroll-section
      data-section-label={label}
      className={`pinned-track relative ${HOLD_CLASS[hold]}`}
    >
      <div
        className={`pinned-inner sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden ${className ?? ""}`}
      >
        {children}
      </div>
    </section>
  );
}
