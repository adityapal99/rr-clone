"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/** The two sizes this cursor has, and nothing in between. */
const BASE_SIZE = 24;
const POINTER_SIZE = 38;
// Fraction of the remaining distance closed per frame. Higher = the ring
// catches up to the raw pointer position faster (snappier); lower reads as
// a laggier trail. 0.22 took ~19 frames (~300ms) to settle on a fast flick,
// long enough to read as latency rather than smoothing.
const LERP = 0.4;
const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, summary, [role="button"], [data-cursor="interactive"]';

/**
 * A pointer-following ring with exactly two states: a small one, and a
 * slightly larger one over anything clickable.
 *
 * It stays centred on the real pointer and keeps its own size in both
 * states — it never measures the element under it, never snaps to that
 * element's centre, and never grows to the element's shape. An earlier
 * version did all three, docking as a capsule sized to whatever control
 * it hovered, which meant the cursor sat *on top of* buttons and their
 * labels instead of pointing at them. Two fixed sizes also make the
 * behaviour predictable: nothing about the page's layout can change what
 * the cursor does, so there are no per-element size thresholds to tune
 * and no forced layout reads on scroll.
 *
 * Deliberately not the "liquid glass" refraction effect used elsewhere
 * (the nav pill) — a live SVG-displacement backdrop-filter is expensive to
 * recomposite on every frame it moves, and this element moves on nearly
 * every frame by definition. Transform + a hollow border only, so what is
 * underneath stays legible right through it.
 *
 * Only mounts on devices with a fine pointer and hover support, and
 * skips the trailing-lerp animation under prefers-reduced-motion.
 */
export function LiquidGlassCursor() {
  // `any-hover`/`any-pointer` (not the primary-only `hover`/`pointer`) so a
  // hybrid touchscreen laptop with a mouse/trackpad still gets the cursor —
  // browsers commonly report the *primary* pointer as coarse/no-hover on
  // such devices even while a fine pointer is actively in use.
  const supported = useMediaQuery("(any-hover: hover) and (any-pointer: fine)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [overInteractive, setOverInteractive] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);

  const outerRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const hoveredEl = useRef<Element | null>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (!supported) return;
    document.documentElement.classList.add("liquid-cursor-active");
    return () => {
      document.documentElement.classList.remove("liquid-cursor-active");
    };
  }, [supported]);

  useEffect(() => {
    if (!supported) return;

    // .closest() re-walks the ancestor chain on every pointerover/pointerout,
    // which fires per DOM-boundary crossing while moving over nested
    // elements — far more often than "entered/left an interactive element".
    // The nearest interactive ancestor of a given node can't change without
    // a re-render (which produces new node identities), so memoize per node.
    const closestInteractiveCache = new WeakMap<Element, Element | null>();
    const resolveInteractive = (el: Element): Element | null => {
      const cached = closestInteractiveCache.get(el);
      if (cached !== undefined) return cached;
      const found = el.closest(INTERACTIVE_SELECTOR);
      closestInteractiveCache.set(el, found);
      return found;
    };

    const onPointerMove = (e: PointerEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
      setVisible(true);
    };

    const onPointerOver = (e: PointerEvent) => {
      const eventTarget = e.target as Element | null;
      const el = eventTarget ? resolveInteractive(eventTarget) : null;
      if (!el || el === hoveredEl.current) return;
      hoveredEl.current = el;
      setOverInteractive(true);
    };

    const onPointerOut = (e: PointerEvent) => {
      const eventTarget = e.target as Element | null;
      const el = eventTarget ? resolveInteractive(eventTarget) : null;
      if (!el || el !== hoveredEl.current) return;
      // Moving between two children of the same control isn't a leave.
      const related = e.relatedTarget as Element | null;
      if (related && el.contains(related)) return;
      hoveredEl.current = null;
      setOverInteractive(false);
    };

    const onPointerDown = () => setPressed(true);
    const onPointerUp = () => setPressed(false);
    const onLeaveWindow = () => setVisible(false);
    const onEnterWindow = () => setVisible(true);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerover", onPointerOver, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeaveWindow);
    document.documentElement.addEventListener("mouseenter", onEnterWindow);

    const tick = () => {
      const ease = reducedMotion ? 1 : LERP;
      current.current.x += (target.current.x - current.current.x) * ease;
      current.current.y += (target.current.y - current.current.y) * ease;

      const node = outerRef.current;
      if (node) {
        node.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0) translate(-50%, -50%)`;
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerover", onPointerOver);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
      document.documentElement.removeEventListener("mouseenter", onEnterWindow);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [supported, reducedMotion]);

  if (!supported) return null;

  const size = overInteractive ? POINTER_SIZE : BASE_SIZE;

  return (
    <div
      ref={outerRef}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[999]"
      style={{ opacity: visible ? 1 : 0, willChange: "transform" }}
    >
      <div
        className="simple-cursor"
        style={{
          width: size,
          height: size,
          transform: `scale(${pressed ? 0.92 : 1})`,
        }}
      />
    </div>
  );
}
