import { useCallback, useEffect, useState } from "react";
import {
  applyLiquidGlassRefraction,
  isRefractionSupported,
  releaseLiquidGlassRefraction,
} from "@/lib/liquid-glass-refraction";

/**
 * Wires an element into the liquid-glass refraction engine (see
 * lib/liquid-glass-refraction.ts): bakes a per-element displacement map
 * and points its `backdrop-filter` at it, rebuilding on element resize
 * and on (debounced) window resize — a viewport resize changes the field
 * for every instance at once, so a drag-resize doesn't rebake every map
 * every frame.
 *
 * Returns a *callback ref* — attach it directly (`<div ref={glassRef}>`)
 * rather than creating your own `useRef`. That matters here: a plain
 * `useRef`'s identity never changes, so an effect keyed on `[ref]` only
 * ever runs once, at first mount — if the element conditionally isn't
 * rendered yet at that point (e.g. behind a "supported" check that
 * resolves a tick after mount), the ref is still null and the effect
 * never gets a second chance. A callback ref fires again every time the
 * node itself changes, including from null to a real element, and
 * wrapping it in state here lets the effect re-run exactly then.
 *
 * Chromium-only — see isRefractionSupported. Everywhere else this is a
 * no-op and the element keeps whatever plain `backdrop-filter` its
 * stylesheet already declares as a fallback.
 */
export function useLiquidGlassRefraction<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node || !isRefractionSupported()) return;

    let currentKey: string | null = null;
    let rebuildHandle = 0;
    let resizeDebounce: ReturnType<typeof setTimeout> | undefined;

    const rebuild = () => {
      if (currentKey) releaseLiquidGlassRefraction(currentKey);
      currentKey = applyLiquidGlassRefraction(node);
    };

    const scheduleRebuild = () => {
      cancelAnimationFrame(rebuildHandle);
      rebuildHandle = requestAnimationFrame(rebuild);
    };

    const onWindowResize = () => {
      clearTimeout(resizeDebounce);
      resizeDebounce = setTimeout(scheduleRebuild, 180);
    };

    const resizeObserver = new ResizeObserver(scheduleRebuild);
    resizeObserver.observe(node);
    window.addEventListener("resize", onWindowResize, { passive: true });
    scheduleRebuild();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
      clearTimeout(resizeDebounce);
      cancelAnimationFrame(rebuildHandle);
      if (currentKey) releaseLiquidGlassRefraction(currentKey);
    };
  }, [node]);

  return ref;
}
