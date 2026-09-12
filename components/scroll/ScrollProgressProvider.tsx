"use client";

import {
  createContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ScrollSectionMeta {
  /** DOM id of the track element, used for anchor jumps. */
  id: string;
  /** Human-readable, already-translated label for the rail's a11y text. */
  label: string;
}

export interface ScrollProgressValue {
  sections: ScrollSectionMeta[];
  activeIndex: number;
}

export const ScrollProgressContext = createContext<ScrollProgressValue>({
  sections: [],
  activeIndex: 0,
});

interface Measured {
  el: HTMLElement;
  top: number;
  height: number;
}

/** Progress at which a section is considered finished and hands off. */
const SNAP_AT = 0.995;
/** Minimum gap between hand-offs, so one gesture can't chain several. */
const SNAP_COOLDOWN_MS = 700;
/**
 * Fraction of the remaining hand-off distance closed per frame. The glide
 * is driven by this lerp (same idiom as the cursor's own position tick)
 * rather than the browser's native `scroll-behavior: smooth` — that
 * duration isn't controllable and commonly runs several hundred ms to over
 * a second for a full section-height jump, which reads as the page taking
 * over rather than a snappy assist. A fixed lerp settles in a small,
 * constant number of frames (~200ms) regardless of distance.
 */
const HANDOFF_LERP = 0.3;
/**
 * Per-frame scroll distance above which we assume the page is being flung or
 * moved programmatically (an anchor jump, a rail button, `scrollIntoView`)
 * rather than read. Handing off during one of those would cut the journey
 * short — a jump to the contact section travels through five finished
 * sections on the way, every one of them momentarily eligible.
 */
const FLING_DELTA_PX = 140;

/**
 * Drives the pinned-section scroll progress for the whole page.
 *
 * Discovers every `[data-scroll-section]` track (rendered by PinnedSection),
 * then on each animation frame works out which one the viewport is inside and
 * how far through it we are.
 *
 * The per-frame value is written to CSS custom properties rather than React
 * state — `--section-progress` on the active track (so section internals can
 * animate against it in pure CSS) and `--rail-progress` on the documentElement
 * (for the tape rail). Only `activeIndex` lives in React state, because it
 * changes a handful of times per page rather than ~60x/second: putting
 * progress in state would re-render the entire tree on every frame of every
 * scroll.
 *
 * When a section's progress completes — the moment the tape marker arrives at
 * the next number — the page hands off to that next section rather than
 * leaving the reader to scroll through the stretch where the finished section
 * slides away. See `maybeHandOff` for why this only ever fires downward.
 */
export function ScrollProgressProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<{
    sections: ScrollSectionMeta[];
    activeIndex: number;
  }>({
    sections: [],
    activeIndex: 0,
  });

  const measured = useRef<Measured[]>([]);
  const activeRef = useRef(-1);
  const rafId = useRef<number | null>(null);
  const needsMeasure = useRef(true);

  const lastScrollY = useRef(0);
  const handOffTarget = useRef<number | null>(null);
  const lastHandOffAt = useRef(0);
  /** Direction of the most recent movement; persists once motion settles. */
  const direction = useRef<"up" | "down" | null>(null);
  /** Whether the page is currently being flung or scrolled programmatically. */
  const flinging = useRef(false);

  useEffect(() => {
    const root = document.documentElement;

    // Pinning is disabled by the same media queries that collapse the tracks
    // in globals.css. Where there is no pin there is no hand-off either —
    // the page is just plain document flow.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const shortViewport = window.matchMedia("(max-height: 700px)");
    const pinningActive = () => !reducedMotion.matches && !shortViewport.matches;

    const collect = () => {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>("[data-scroll-section]"),
      );

      setValue((prev) => {
        const next = els.map((el) => ({
          id: el.id,
          label: el.dataset.sectionLabel ?? "",
        }));
        // Avoid a state write (and re-render) when nothing actually changed.
        const same =
          prev.sections.length === next.length &&
          prev.sections.every(
            (s, i) => s.id === next[i].id && s.label === next[i].label,
          );
        return same ? prev : { ...prev, sections: next };
      });

      return els;
    };

    let els = collect();

    const measure = () => {
      measured.current = els.map((el) => ({
        el,
        top: el.offsetTop,
        height: el.offsetHeight,
      }));
      needsMeasure.current = false;
    };

    /**
     * Hand off to the next section once this one is complete.
     *
     * Two things this must not do:
     *
     * - Fire while scrolling up. Crossing a boundary upward lands you in the
     *   previous track at progress 1 — a completed section — so an unguarded
     *   rule would immediately fling you back down and trap you at the seam.
     * - Fire mid-flight during a fling or a programmatic scroll. An anchor
     *   jump to the contact section travels through every finished section on
     *   the way, so it would be cut short almost immediately.
     *
     * Hence: direction must be down, motion must not be a fling, and there is
     * a cooldown plus an in-flight target check on top.
     */
    const maybeHandOff = (
      index: number,
      progress: number,
      list: Measured[],
      scrollY: number,
      now: number,
    ) => {
      if (!pinningActive()) return;
      if (handOffTarget.current !== null) return;
      if (progress < SNAP_AT) return;
      if (index >= list.length - 1) return;
      if (direction.current !== "down") return;
      if (flinging.current) return;
      if (now - lastHandOffAt.current < SNAP_COOLDOWN_MS) return;

      const target = list[index + 1].top;
      if (target <= scrollY) return;

      handOffTarget.current = target;
      lastHandOffAt.current = now;
      // The glide itself is driven by the lerp step at the top of tick(),
      // not a native scrollTo animation — see HANDOFF_LERP.
    };

    const tick = () => {
      if (needsMeasure.current) measure();

      const list = measured.current;
      if (list.length) {
        let scrollY = window.scrollY;
        const viewportH = window.innerHeight;
        const now = performance.now();

        if (handOffTarget.current !== null) {
          const diff = handOffTarget.current - scrollY;
          if (Math.abs(diff) < 1) {
            // Arrived: snap exactly rather than asymptotically approach.
            scrollY = handOffTarget.current;
            handOffTarget.current = null;
          } else {
            scrollY += diff * HANDOFF_LERP;
          }
          // `behavior: "instant"` bypasses `html { scroll-behavior: smooth }`
          // for this per-frame set — we're already animating it ourselves.
          window.scrollTo({ top: scrollY, behavior: "instant" });
        }

        const delta = scrollY - lastScrollY.current;

        // Nothing moved since last frame (no input, no in-flight glide) —
        // skip the recompute and custom-property writes below entirely
        // rather than re-writing identical values on every idle frame.
        if (delta === 0 && handOffTarget.current === null) {
          rafId.current = requestAnimationFrame(tick);
          return;
        }

        // Direction persists through a pause so that overshooting the
        // completion point and stopping still hands off; `flinging` clears the
        // moment motion settles, which is what lets a programmatic scroll
        // finish untouched and then behave normally again.
        direction.current = delta > 0 ? "down" : "up";
        flinging.current = Math.abs(delta) > FLING_DELTA_PX;

        // Abandon an in-flight glide if the reader scrolled it themselves
        // (back up, away from the target) — hand control back immediately.
        if (handOffTarget.current !== null && delta < 0) {
          handOffTarget.current = null;
        }

        let index = 0;
        for (let i = 0; i < list.length; i++) {
          // +1px guards the exact boundary between two adjacent tracks.
          if (scrollY + 1 >= list[i].top) index = i;
        }

        const { el, top, height } = list[index];
        // A track is `height` tall but only scrolls for `height - viewportH`
        // before the next one takes over; that difference is the real travel.
        const travel = Math.max(height - viewportH, 1);
        const progress = Math.min(Math.max((scrollY - top) / travel, 0), 1);

        el.style.setProperty("--section-progress", progress.toFixed(4));

        if (index !== activeRef.current) {
          const previous = list[activeRef.current];
          // Leave the section we just left in its finished state rather than
          // stranding it mid-animation.
          if (previous) {
            previous.el.style.setProperty(
              "--section-progress",
              index > activeRef.current ? "1" : "0",
            );
          }
          activeRef.current = index;
          setValue((prev) =>
            prev.activeIndex === index ? prev : { ...prev, activeIndex: index },
          );
        }

        // Dividing by `list.length` (not `list.length - 1`) is deliberate:
        // with the previous denominator, progress already read 1.0 the
        // instant the *last* section began (index = length-1, progress = 0
        // → (length-1)/(length-1) = 1) and then sat pinned there for that
        // section's whole duration. Dividing by the full length keeps this
        // monotonic across every section and only reaches 1.0 at the true
        // bottom of the page — which matters since the tape rail's reveal
        // (`.tape-reveal` in globals.css) is keyed to progress reaching 1.
        const railProgress = list.length > 0 ? (index + progress) / list.length : 0;
        root.style.setProperty("--rail-progress", railProgress.toFixed(4));

        maybeHandOff(index, progress, list, scrollY, now);
        lastScrollY.current = scrollY;
      }

      rafId.current = requestAnimationFrame(tick);
    };

    const invalidate = () => {
      needsMeasure.current = true;
    };

    const resizeObserver = new ResizeObserver(invalidate);
    const main = document.getElementById("main-content");
    if (main) resizeObserver.observe(main);

    window.addEventListener("resize", invalidate);
    reducedMotion.addEventListener("change", invalidate);
    shortViewport.addEventListener("change", invalidate);
    rafId.current = requestAnimationFrame(tick);

    // The section list is authored server-side, so it only changes across
    // navigations — re-collect once after mount in case hydration reordered.
    const recollect = window.setTimeout(() => {
      els = collect();
      invalidate();
    }, 0);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", invalidate);
      reducedMotion.removeEventListener("change", invalidate);
      shortViewport.removeEventListener("change", invalidate);
      window.clearTimeout(recollect);
      if (rafId.current) cancelAnimationFrame(rafId.current);
      root.style.removeProperty("--rail-progress");
    };
  }, []);

  return (
    <ScrollProgressContext.Provider value={value}>
      {children}
    </ScrollProgressContext.Provider>
  );
}
