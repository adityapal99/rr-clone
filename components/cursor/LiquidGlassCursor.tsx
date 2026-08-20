"use client";

import { useEffect, useRef, useState } from "react";
import { useLiquidGlassRefraction } from "@/hooks/useLiquidGlassRefraction";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const BASE_SIZE = 26;
const HOVER_SIZE = 44;
const DOCK_PADDING = 14;
const LERP = 0.22;
// Elements at or below this footprint read as "controls" (buttons, pills,
// nav links) and get the full magnetic capsule dock. Anything larger —
// card tiles, full-panel links — only gets a modest size bump so the
// glass never balloons to cover an entire tile.
const MAX_DOCK_WIDTH = 320;
const MAX_DOCK_HEIGHT = 100;
const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, summary, [role="button"], [data-cursor="interactive"]';

interface Point {
  x: number;
  y: number;
}

interface Shape {
  w: number;
  h: number;
  radius: number;
}

const DEFAULT_SHAPE: Shape = { w: BASE_SIZE, h: BASE_SIZE, radius: BASE_SIZE / 2 };
const HOVER_SHAPE: Shape = { w: HOVER_SIZE, h: HOVER_SIZE, radius: HOVER_SIZE / 2 };

function shapeFromRect(rect: DOMRect): Shape {
  const w = rect.width + DOCK_PADDING;
  const h = rect.height + DOCK_PADDING;
  return { w, h, radius: h / 2 };
}

/**
 * A pointer-following "liquid glass" cursor: the same refraction engine
 * as the nav bar (useLiquidGlassRefraction — a per-size displacement map
 * baked from the shell's own rounded shape, run against the real page
 * behind it via `backdrop-filter: url(#id)`), so it bends whatever is
 * beneath it exactly the same way, at every size. It morphs into a
 * capsule that docks over compact controls it hovers (buttons, pills, nav
 * links); larger clickable areas (cards, full-panel links) only get a
 * modest size bump rather than a dock, so the glass never grows to cover
 * an entire tile. The refraction stays active across every one of those
 * shapes — default, hover, docked — not just one of them.
 *
 * Only mounts on devices with a fine pointer and hover support, and
 * skips the trailing-lerp animation under prefers-reduced-motion.
 */
export function LiquidGlassCursor() {
  const supported = useMediaQuery("(hover: hover) and (pointer: fine)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [dockShape, setDockShape] = useState<Shape | null>(null);
  const [largeHover, setLargeHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);

  const outerRef = useRef<HTMLDivElement>(null);
  const shellRef = useLiquidGlassRefraction<HTMLDivElement>();
  const rawPointer = useRef<Point>({ x: 0, y: 0 });
  const target = useRef<Point>({ x: 0, y: 0 });
  const current = useRef<Point>({ x: 0, y: 0 });
  const dockedEl = useRef<Element | null>(null);
  const largeHoverEl = useRef<Element | null>(null);
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

    const updateDockedTarget = () => {
      const el = dockedEl.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      target.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      setDockShape(shapeFromRect(rect));
    };

    const onPointerMove = (e: PointerEvent) => {
      rawPointer.current = { x: e.clientX, y: e.clientY };
      if (!dockedEl.current) target.current = { ...rawPointer.current };
      setVisible(true);
    };

    const onPointerOver = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest(INTERACTIVE_SELECTOR);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const isCompact = rect.width <= MAX_DOCK_WIDTH && rect.height <= MAX_DOCK_HEIGHT;

      if (isCompact) {
        if (el === dockedEl.current) return;
        dockedEl.current = el;
        largeHoverEl.current = null;
        setLargeHover(false);
        updateDockedTarget();
      } else {
        if (el === largeHoverEl.current) return;
        largeHoverEl.current = el;
        dockedEl.current = null;
        setDockShape(null);
        setLargeHover(true);
      }
    };

    const onPointerOut = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest(INTERACTIVE_SELECTOR);
      if (!el) return;
      const related = e.relatedTarget as Element | null;
      if (related && el.contains(related)) return;

      if (el === dockedEl.current) {
        dockedEl.current = null;
        setDockShape(null);
        target.current = { ...rawPointer.current };
      }
      if (el === largeHoverEl.current) {
        largeHoverEl.current = null;
        setLargeHover(false);
      }
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
    window.addEventListener("scroll", updateDockedTarget, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", updateDockedTarget);
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
      window.removeEventListener("scroll", updateDockedTarget, true);
      window.removeEventListener("resize", updateDockedTarget);
      document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
      document.documentElement.removeEventListener("mouseenter", onEnterWindow);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [supported, reducedMotion]);

  if (!supported) return null;

  const shape = dockShape ?? (largeHover ? HOVER_SHAPE : DEFAULT_SHAPE);

  return (
    <div
      ref={outerRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[999]"
      style={{ opacity: visible ? 1 : 0, willChange: "transform" }}
    >
      <div
        ref={shellRef}
        className="liquid-glass-shell"
        style={{
          width: shape.w,
          height: shape.h,
          borderRadius: shape.radius,
          transform: `scale(${pressed ? 0.92 : 1})`,
        }}
      />
    </div>
  );
}
