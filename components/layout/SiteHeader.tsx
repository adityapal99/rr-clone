"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useLiquidGlassRefraction } from "@/hooks/useLiquidGlassRefraction";
import { logoImage } from "@/lib/content";
import { NavOverlay } from "./NavOverlay";

/**
 * A floating, pill-shaped liquid-glass navigation bar — see
 * `.liquid-glass-nav` in globals.css for the tint/rim, and
 * useLiquidGlassRefraction for the bending itself: a displacement map
 * baked from the bar's own size and radius, run against the *real*
 * backdrop via `backdrop-filter: url(#id)`. What's actually behind the
 * bar warps at its rim — a photo's edges bow along their own contours —
 * rather than the bar wearing a flat white "glassmorphism" sheen on top
 * of a blur.
 *
 * Compact and centered at the top of the page; widens toward the full
 * inset width once the page scrolls, while staying fully rounded — the
 * refraction map rebakes automatically as it does, since it's already
 * watching the pill's size via ResizeObserver.
 *
 * Known Chromium quirk: if the page loads already scrolled (a hard
 * refresh, a back/forward restore) the `max-width` transition can start
 * pinned to its pre-scroll value instead of animating, even though the
 * class and layout are both already correct — it self-corrects on the
 * next real scroll, so it's a cosmetic one-frame issue on a narrow path
 * rather than a stuck state.
 *
 * Rendered as a sibling of the pill's own decorative layers, not a
 * child: the pill's `backdrop-filter` establishes a new containing
 * block for `position: fixed` descendants, which would otherwise
 * collapse the fullscreen nav overlay to the pill's own height instead
 * of the viewport.
 */
export function SiteHeader() {
  const tA11y = useTranslations("a11y");
  const tHeader = useTranslations("header");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // The first hover/focus of this button is the menu's cue to start
  // fetching its photography, well before the click lands.
  const [armed, setArmed] = useState(false);
  // Bumped on every open so the menu can key its entrance animation on it
  // and replay the staggered rise. Counted here rather than in the overlay
  // because a click handler is the honest place to advance it.
  const [openCount, setOpenCount] = useState(0);
  const pillRef = useLiquidGlassRefraction<HTMLElement>();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hand focus back to the button the menu was opened from — but only on
  // a real close, not on the first render, when nothing has moved yet.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      toggleRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const toggleMenu = () => {
    const next = !open;
    setOpen(next);
    if (next) setOpenCount((count) => count + 1);
  };

  return (
    <>
      {/* The bar retires while the menu is open — it slides up out of the
          viewport and comes back on close, so the photography behind it
          gets the whole screen. `inert` while it is away: a control that
          has been translated off-screen is still focusable otherwise, and
          it takes the skip link with it. The menu carries its own close
          button, since this is where the toggle lives.

          The transition names `translate`, not `transform`: Tailwind v4
          compiles `-translate-y-32` to the standalone `translate`
          property, so a `transition-[transform,...]` here animates
          nothing and the bar teleports. (The built-in
          `transition-transform` utility covers all four of transform,
          translate, scale and rotate — it is only spelled-out arbitrary
          values that have to name the right one.) */}
      <div
        id="top"
        inert={open}
        className={`fixed inset-x-0 top-4 z-50 flex justify-center px-4 transition-[translate,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:top-6 ${
          open ? "-translate-y-32 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded focus:bg-rr-ink focus:px-3 focus:py-2 focus:text-rr-black"
        >
          {tA11y("skipToContent")}
        </a>

        <header
          ref={pillRef}
          className={`liquid-glass-nav w-full rounded-full ${scrolled ? "max-w-6xl" : "max-w-3xl"}`}
        >
          <div className="relative grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2 pe-2 ps-4 sm:gap-4 sm:py-2.5 sm:pe-2.5 sm:ps-6">
            <button
              ref={toggleRef}
              type="button"
              data-cursor="interactive"
              aria-expanded={open}
              aria-controls="site-navigation"
              onClick={toggleMenu}
              onPointerEnter={() => setArmed(true)}
              onFocus={() => setArmed(true)}
              className="flex items-center gap-2 justify-self-start text-xs tracking-[0.25em] text-rr-ink uppercase"
            >
              <span className="relative flex h-3 w-5 flex-col justify-between">
                <span
                  className={`h-px w-full bg-current transition-transform duration-300 ${open ? "translate-y-[5.5px] rotate-45" : ""}`}
                />
                <span
                  className={`h-px w-full bg-current transition-opacity duration-200 ${open ? "opacity-0" : "opacity-100"}`}
                />
                <span
                  className={`h-px w-full bg-current transition-transform duration-300 ${open ? "-translate-y-[5.5px] -rotate-45" : ""}`}
                />
              </span>
              <span className="hidden sm:inline">
                {open ? tA11y("closeMenu") : tA11y("openMenu")}
              </span>
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element -- remote vector wordmark, no optimization benefit */}
            <img
              src={logoImage.src}
              alt="Trends Garments"
              className="h-5 w-auto justify-self-center brightness-0 invert sm:h-6"
            />

            <a
              href="#contact"
              data-cursor="interactive"
              className="justify-self-end rounded-full border border-rr-hairline-strong px-4 py-2 text-[11px] tracking-[0.2em] text-rr-ink uppercase transition-colors hover:border-rr-ink sm:px-5"
            >
              {tHeader("cta")}
            </a>
          </div>
        </header>
      </div>

      <NavOverlay
        open={open}
        armed={armed}
        openId={openCount}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
