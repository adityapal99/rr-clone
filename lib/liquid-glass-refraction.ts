/*!
 * Liquid Glass — refraction engine (framework-agnostic core).
 *
 * The refraction field is a port of the fragment shader in liquid-glass-js
 * (https://github.com/dashersw/liquid-glass-js) — Copyright (c) 2025 Armagan
 * Amcalar, MIT. Permission is hereby granted, free of charge, to any person
 * obtaining a copy of that software to deal in it without restriction,
 * provided this notice travels with it; it is provided "as is", without
 * warranty of any kind. Keep this header on any copy or port.
 *
 * Ported from the Angular reference directive (liquid-glass skill,
 * assets/liquid-glass.directive.ts) to plain DOM APIs so it can be driven
 * from a React hook — see hooks/useLiquidGlassRefraction.ts. The pipeline
 * and every constant below are explained in that skill's
 * references/refraction.md; read it before changing a number.
 *
 * Real glass bends what is behind it, most sharply near its edge. Per
 * element, once per (size, radius, viewport) key, this bakes that
 * exponential-falloff refraction field into a <canvas> displacement map,
 * wires it into a shared SVG filter (feImage -> feDisplacementMap ->
 * feGaussianBlur), and the caller points the element at it via
 * `backdropFilter: url(#id)`. Because it is a *backdrop* filter, the
 * thing being bent is the live page behind the element — scrolling,
 * animation and content changes are tracked for free.
 */

/**
 * Mirrors the shader uniforms of liquid-glass-js; names match its control
 * panel. Distances are exponential-falloff rates per pixel from the shape
 * edge, intensities are in page-texture fraction units.
 */
export interface LiquidGlassConfig {
  edgeIntensity: number;
  rimIntensity: number;
  baseIntensity: number;
  edgeDistance: number;
  rimDistance: number;
  baseDistance: number;
  cornerBoost: number;
  rippleEffect: number;
  blurRadius: number;
  /** Center distortion ("Enable Center Warp"); off keeps the middle legible. */
  warp: boolean;
}

/** Hand-tuned in the library's demo controls; the tint lives in CSS. */
export const GLASS_PRESET: LiquidGlassConfig = {
  edgeIntensity: 0.015,
  rimIntensity: 0.028,
  baseIntensity: 0.05,
  edgeDistance: 0.5,
  rimDistance: 1.7,
  baseDistance: 0.2,
  cornerBoost: 0.06,
  rippleEffect: 0.26,
  blurRadius: 2,
  warp: false,
};

/**
 * Render the displacement map at 2x the element's CSS size. The rim
 * refraction lives in a 1-2px band; a 1x map lets the browser resample it
 * into a wide smear. Supersampling gives feImage enough source detail to
 * keep the edge lens crisp.
 */
const SUPERSAMPLE = 2;

/**
 * Cap the baked map's longest (supersampled) edge. Refraction is edge-local,
 * so a wide topbar does not need a full 2x map through its neutral middle;
 * this keeps the per-pixel bake and the data-URL size bounded for big
 * surfaces.
 */
const MAX_MAP_EDGE = 1400;

/**
 * feGaussianBlur stdDeviation per unit of the config's blurRadius. The
 * library blurs in a 13-tap page-texture kernel with no 1:1 SVG gaussian
 * equivalent; this factor was fit so blurRadius 2 matches its frosting.
 */
const BLUR_STD_PER_RADIUS = 0.35;

interface FilterEntry {
  id: string;
  node: SVGFilterElement;
  refs: number;
}

const filters = new Map<string, FilterEntry>();
let defs: SVGSVGElement | null = null;
let nextId = 0;

/**
 * Cap on how many filter DOM nodes (exact w/h/radius/viewport/config match)
 * stay cached at once. Idle entries (refs back to 0, e.g. after an unhover)
 * are kept rather than torn down immediately — see releaseFilter — so a
 * re-hover of the same shape is a cache hit. This bounds how many can pile
 * up: the cursor and nav pill each only ever have a handful of distinct
 * shapes in real use (default dot, a docked capsule per interactive
 * element's footprint, the large-hover circle), so this is generous.
 */
const MAX_CACHED_FILTER_NODES = 24;

/** Bump `key` to most-recently-used position (Map iteration is insertion order). */
function touchFilterEntry(key: string, entry: FilterEntry): void {
  filters.delete(key);
  filters.set(key, entry);
}

/** Evict the oldest *idle* (refs <= 0) entry once the cache is full. Never
 * tears down something still on screen (refs > 0). */
function evictIdleFilterIfNeeded(): void {
  if (filters.size < MAX_CACHED_FILTER_NODES) return;
  for (const [k, e] of filters) {
    if (e.refs <= 0) {
      filters.delete(k);
      e.node.remove();
      return;
    }
  }
}

/**
 * Backdrop-filters referencing SVG filters are Chromium-only. Feature
 * queries can't tell (Safari parses but paints nothing), so gate on engine.
 */
export function isRefractionSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  const brands = (
    navigator as Navigator & {
      userAgentData?: { brands: { brand: string }[] };
    }
  ).userAgentData?.brands;
  if (brands) {
    return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
  }
  return /Chrome\//.test(navigator.userAgent);
}

/** Resolve a computed border-radius (px, or a huge value for "full") to CSS pixels. */
function resolveRadius(computed: string, w: number, h: number): number {
  const value = parseFloat(computed) || 0;
  const resolved = computed.trim().endsWith("%") ? (value / 100) * Math.min(w, h) : value;
  return Math.min(resolved, Math.min(w, h) / 2);
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Bake the shader's refraction field into a displacement map: R/G encode
 * the x/y sample offset around neutral 128, scaled so the extremes span
 * the feDisplacementMap `scale`. Formulas transcribed 1:1 from
 * liquid-glass-js's container.js.
 */
function buildDisplacementMap(
  w: number,
  h: number,
  radius: number,
  pageW: number,
  pageH: number,
  cfg: LiquidGlassConfig,
): { mapUrl: string; scale: number } {
  const ss = Math.max(0.25, Math.min(SUPERSAMPLE, MAX_MAP_EDGE / Math.max(w, h)));
  const bw = Math.max(1, Math.round(w * ss));
  const bh = Math.max(1, Math.round(h * ss));
  const r = radius * ss;
  const minDim = Math.min(w, h);
  const dx = new Float32Array(bw * bh);
  const dy = new Float32Array(bw * bh);
  let maxAbs = 0;

  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const cx = (px + 0.5) / bw;
      const cy = (py + 0.5) / bh;

      // Signed distance to the rounded-rect edge (supersampled px -> CSS px).
      const tx = Math.abs(px + 0.5 - bw / 2) - (bw / 2 - r);
      const ty = Math.abs(py + 0.5 - bh / 2) - (bh / 2 - r);
      const outside = Math.hypot(Math.max(tx, 0), Math.max(ty, 0));
      const inside = Math.min(Math.max(tx, ty), 0);
      const distPx = Math.max(-(outside + inside - r), 0) / ss;

      const edgeFall = Math.exp(-distPx * cfg.edgeDistance);
      const rimFall = Math.exp(-distPx * cfg.rimDistance);
      const baseFall = 1 - Math.exp(-distPx * cfg.baseDistance);
      const baseComponent = cfg.warp ? baseFall * cfg.baseIntensity : 0;
      const total = baseComponent + edgeFall * cfg.edgeIntensity + rimFall * cfg.rimIntensity;

      // The shader's rounded-rect normal is taken in texcoord space.
      let nx = cx - 0.5;
      let ny = cy - 0.5;
      const len = Math.hypot(nx, ny);
      if (len > 0) {
        nx /= len;
        ny /= len;
      }

      const cornerNorm = Math.max(Math.min(cx, 1 - cx), Math.min(cy, 1 - cy)) * minDim;
      const corner = Math.exp(-cornerNorm * 0.3) * cfg.cornerBoost;

      const ripple = Math.sin((distPx / minDim) * 25) * cfg.rippleEffect * rimFall;

      // normal * (refraction + corner boost) + perpendicular * ripple,
      // converted from page-texture fractions to pixels.
      const fx = (nx * (total + corner) - ny * ripple) * pageW;
      const fy = (ny * (total + corner) + nx * ripple) * pageH;

      const i = py * bw + px;
      dx[i] = fx;
      dy[i] = fy;
      maxAbs = Math.max(maxAbs, Math.abs(fx), Math.abs(fy));
    }
  }

  // The field scales intensities by pageW/pageH (viewport size, not
  // element size — see the module doc). That's a fine assumption for a
  // near-viewport-sized panel, but a compact UI surface (a toolbar, a
  // cursor blob) is often a small fraction of the viewport, so the same
  // intensities can produce a raw displacement several times the
  // element's own height — which balloons the filter's region past what
  // Chromium renders correctly (it starts corrupting compositing well
  // outside the element's own box, not just failing to look like glass).
  // Clamp the *magnitude* uniformly rather than the formula's shape, so
  // edge/rim/corner/ripple stay in the same proportions the preset was
  // tuned for, just bounded to something sane for a small surface.
  const MAX_DISPLACEMENT_PX = 34;
  if (maxAbs > MAX_DISPLACEMENT_PX) {
    const k = MAX_DISPLACEMENT_PX / maxAbs;
    for (let i = 0; i < dx.length; i++) {
      dx[i] *= k;
      dy[i] *= k;
    }
    maxAbs = MAX_DISPLACEMENT_PX;
  }

  const scale = Math.max(maxAbs * 2, 1e-4);
  // feDisplacementMap decodes byte b as scale*(b/255 - 0.5); since
  // 128/255 != 0.5, a naive neutral (128) would shift the whole interior
  // by scale/510 px. Pre-subtract that decode bias so zero displacement
  // stays put (warp off => the middle must read undistorted).
  const bias = scale * (128 / 255 - 0.5);
  const canvas = document.createElement("canvas");
  canvas.width = bw;
  canvas.height = bh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { mapUrl: "", scale };
  const image = ctx.createImageData(bw, bh);
  const data = image.data;
  for (let i = 0; i < bw * bh; i++) {
    data[i * 4] = clampByte(255 * (0.5 + (dx[i] - bias) / scale));
    data[i * 4 + 1] = clampByte(255 * (0.5 + (dy[i] - bias) / scale));
    data[i * 4 + 2] = 128;
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return { mapUrl: canvas.toDataURL("image/png"), scale };
}

interface BakedMap {
  mapUrl: string;
  scale: number;
}

/**
 * buildDisplacementMap's nested pixel loop + synchronous toDataURL() is the
 * expensive part of a bake. A CSS-driven size transition (e.g. the cursor's
 * dock/undock, or the nav pill's expand/collapse) fires a ResizeObserver
 * signal on nearly every frame of the transition, and every distinct exact
 * (w, h) pair used to mean a full rebake — including re-hovering a shape
 * that had already been baked moments earlier, since releaseFilter used to
 * tear the old entry down the instant it was unhovered.
 *
 * This cache reuses a raster across *nearby* sizes: keyed on w/h/radius
 * quantized to a coarse bucket (plus the viewport and config, which also
 * affect the field), a hit skips the pixel loop and toDataURL() entirely.
 * The exact-geometry SVG attributes (margins, feImage width/height) are
 * still computed fresh from the live w/h in acquireFilter — only the raster
 * itself is shared, accepting a few px of resample stretch that the
 * following feGaussianBlur pass already makes imperceptible.
 */
const bakeCache = new Map<string, BakedMap>();
const MAX_BAKE_CACHE_ENTRIES = 24;
const QUANT_SIZE_PX = 4;
const QUANT_RADIUS_PX = 2;
const QUANT_VIEWPORT_PX = 20;

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function getBakedMap(
  w: number,
  h: number,
  radius: number,
  pageW: number,
  pageH: number,
  cfg: LiquidGlassConfig,
): BakedMap {
  const bucketKey = [
    quantize(w, QUANT_SIZE_PX),
    quantize(h, QUANT_SIZE_PX),
    quantize(radius, QUANT_RADIUS_PX),
    quantize(pageW, QUANT_VIEWPORT_PX),
    quantize(pageH, QUANT_VIEWPORT_PX),
    JSON.stringify(cfg),
  ].join("|");

  const cached = bakeCache.get(bucketKey);
  if (cached) {
    // Bump to most-recently-used.
    bakeCache.delete(bucketKey);
    bakeCache.set(bucketKey, cached);
    return cached;
  }

  const baked = buildDisplacementMap(w, h, radius, pageW, pageH, cfg);
  bakeCache.set(bucketKey, baked);
  if (bakeCache.size > MAX_BAKE_CACHE_ENTRIES) {
    const oldestKey = bakeCache.keys().next().value;
    if (oldestKey !== undefined) bakeCache.delete(oldestKey);
  }
  return baked;
}

function ensureDefs(): SVGSVGElement {
  if (!defs || !defs.isConnected) {
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg") as SVGSVGElement;
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "fixed";
    svg.setAttribute("aria-hidden", "true");
    svg.appendChild(document.createElementNS(svgNs, "defs"));
    document.body.appendChild(svg);
    defs = svg;
  }
  return defs;
}

/** Same-size cards (the common case in a list) share one filter. */
function acquireFilter(
  key: string,
  w: number,
  h: number,
  radius: number,
  pageW: number,
  pageH: number,
  cfg: LiquidGlassConfig,
): FilterEntry {
  let entry = filters.get(key);
  // Reuse only if the cached node is still in the live document — if the
  // shared defs <svg> was ever detached, its url(#id) no longer resolves.
  if (entry && entry.node.isConnected) {
    entry.refs++;
    touchFilterEntry(key, entry);
    return entry;
  }
  if (entry) {
    filters.delete(key);
    entry.node.remove();
  }
  evictIdleFilterIfNeeded();
  const { mapUrl, scale } = getBakedMap(w, h, radius, pageW, pageH, cfg);
  const id = `liquid-glass-${nextId++}`;

  const svgNs = "http://www.w3.org/2000/svg";
  const filter = document.createElementNS(svgNs, "filter") as SVGFilterElement;
  filter.setAttribute("id", id);
  // Edge pixels sample the backdrop up to `scale/2` away, plus the blur
  // spread; the region must extend past the box by at least that or the
  // refraction clips to transparent at the corners. Displacement is
  // viewport-proportional, so on a small element this margin can exceed
  // the box — size it from the actual field, not a fixed 30%.
  const marginPx = scale / 2 + 3 * cfg.blurRadius * BLUR_STD_PER_RADIUS;
  const mx = (marginPx / w) * 100;
  const my = (marginPx / h) * 100;
  filter.setAttribute("x", `${-mx}%`);
  filter.setAttribute("y", `${-my}%`);
  filter.setAttribute("width", `${100 + 2 * mx}%`);
  filter.setAttribute("height", `${100 + 2 * my}%`);
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.dataset.key = key;

  const feImage = document.createElementNS(svgNs, "feImage");
  feImage.setAttribute("href", mapUrl);
  feImage.setAttribute("x", "0");
  feImage.setAttribute("y", "0");
  feImage.setAttribute("width", String(w));
  feImage.setAttribute("height", String(h));
  feImage.setAttribute("preserveAspectRatio", "none");
  feImage.setAttribute("result", "map");

  const feDisplacement = document.createElementNS(svgNs, "feDisplacementMap");
  feDisplacement.setAttribute("in", "SourceGraphic");
  feDisplacement.setAttribute("in2", "map");
  feDisplacement.setAttribute("scale", String(scale));
  feDisplacement.setAttribute("xChannelSelector", "R");
  feDisplacement.setAttribute("yChannelSelector", "G");
  feDisplacement.setAttribute("result", "displaced");

  // Frosting on the refracted sample (see BLUR_STD_PER_RADIUS).
  const feBlur = document.createElementNS(svgNs, "feGaussianBlur");
  feBlur.setAttribute("in", "displaced");
  feBlur.setAttribute("stdDeviation", String(cfg.blurRadius * BLUR_STD_PER_RADIUS));

  filter.append(feImage, feDisplacement, feBlur);
  ensureDefs().querySelector("defs")?.appendChild(filter);

  entry = { id, node: filter, refs: 1 };
  filters.set(key, entry);
  return entry;
}

function releaseFilter(key: string): void {
  const entry = filters.get(key);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  // Idle entries (refs back to 0) are deliberately kept rather than torn
  // down immediately — a shape that was just unhovered is exactly the one
  // most likely to be re-hovered next. Eviction happens lazily, in
  // acquireFilter, once the cache is actually full.
}

/**
 * Bake (or reuse) the refraction field for `element` at its current size
 * and point its `backdropFilter` at it. Returns the cache key so the
 * caller can release it later and skip rebuilding when nothing changed.
 */
export function applyLiquidGlassRefraction(
  element: HTMLElement,
  config?: Partial<LiquidGlassConfig>,
): string | null {
  const w = Math.round(element.offsetWidth);
  const h = Math.round(element.offsetHeight);
  if (w < 2 || h < 2) return null;

  const radius = resolveRadius(getComputedStyle(element).borderTopLeftRadius, w, h);
  // The shader displaces in fractions of the page snapshot; the live
  // equivalent of that snapshot is the viewport.
  const pageW = window.innerWidth;
  const pageH = window.innerHeight;
  const cfg: LiquidGlassConfig = { ...GLASS_PRESET, ...config };

  const key = [w, h, radius, pageW, pageH, JSON.stringify(cfg)].join("|");
  const entry = acquireFilter(key, w, h, radius, pageW, pageH, cfg);
  element.style.backdropFilter = `url(#${entry.id})`;
  return key;
}

export { releaseFilter as releaseLiquidGlassRefraction };
