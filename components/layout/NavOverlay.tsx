"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { isRtlLocale } from "@/i18n/routing";
import {
  contactLinks,
  megaMenu,
  menuFrames,
  type MegaMenuGroup,
  type MegaMenuLink,
  type MenuFrame,
} from "@/lib/content";
import { LocaleSwitcher } from "./LocaleSwitcher";

interface NavOverlayProps {
  open: boolean;
  onClose: () => void;
  /**
   * Increments on every open. Used as the overlay body's React key, which
   * is what replays the staggered rise — remounting is both cheaper and
   * far more reliable than toggling classes to restart an animation.
   */
  openId: number;
  /**
   * Set once the header's menu button has been hovered or focused.
   * Mounting the preview stack on that first hint gives the browser a
   * head start on the photography, so the opening wipe lands on a
   * decoded image instead of an empty frame.
   */
  armed?: boolean;
}

/** Matches the overlay's own fade-out, so resets land unseen. */
const CLOSE_MS = 500;

/** Ordinal for the staggered rise — see `.rr-menu-item` in globals.css. */
const stagger = (index: number) => ({ "--i": index }) as CSSProperties;

/** Which frame is on screen, and the one it is sliding over. */
interface FrameState {
  current: string | null;
  previous: string | null;
}

/**
 * Every photo the menu can show, layered in one box and tagged
 * `current` / `previous` / idle so `.rr-menu-frame` in globals.css can
 * slide the incoming one in over the outgoing one.
 *
 * Rendered twice: sharp in the photographic half, and again behind the
 * navigation half where `.rr-menu-wash` blurs it, so both halves are lit
 * by the same picture and shift together when it changes. Both copies ask
 * for the same `sizes`, so they resolve to one optimized URL and the
 * second is served from cache — the echo costs no extra bytes.
 */
function FrameStack({ frames }: { frames: FrameState }) {
  return menuFrames.map((frame) => (
    <div
      key={frame.id}
      className="rr-menu-frame"
      data-state={
        frames.current === frame.id
          ? "current"
          : frames.previous === frame.id
            ? "previous"
            : "idle"
      }
    >
      <Image
        src={frame.image.src}
        alt=""
        fill
        sizes="50vw"
        // Held slightly low in frame: every one of these photographs
        // carries its subject below the midline.
        className="rr-menu-frame-media object-cover object-[50%_65%] contrast-[1.05] brightness-[1.05] saturate-[0.6]"
      />
    </div>
  ));
}

/**
 * Fullscreen mega menu in the Rolls-Royce mould: the viewport split in
 * two equal halves from `lg` up — navigation on one side, a single
 * full-bleed photograph on the other, running the whole height of the
 * screen and out to its edge.
 *
 * Three panes, and the whole thing is driven by two pieces of state.
 * `activeKey` picks the rail entry, whose children fill the detail
 * column beside it; `previewId` is the one child currently under the
 * pointer or keyboard focus. Together they name the *frame* the preview
 * column should be showing, and every reveal follows from that: pointing
 * at "Products" wipes the collections photo in, running down its five
 * collections wipes each one over the last, and stepping back out
 * returns to the group's own photo.
 *
 * The reveal itself is CSS (see FrameStack and `.rr-menu-frame`): React
 * only decides *which* frame is current; it never drives an animation
 * frame.
 *
 * The photography exists from `lg` up only, gated in JS rather than with
 * `hidden lg:block`: it is decorative, and a phone should never pay to
 * download thirteen of them. Below that breakpoint the navigation simply
 * takes the full width, and the rail and detail column stack, so tapping
 * a group still opens its sub-navigation underneath.
 *
 * The menu owns its own close button because the header pill slides up
 * out of the way while it is open (see SiteHeader) — taking the toggle
 * that opened it with it.
 */
export function NavOverlay({
  open,
  onClose,
  openId,
  armed = false,
}: NavOverlayProps) {
  const tNav = useTranslations("nav");
  const tMenu = useTranslations("menu");
  const tStory = useTranslations("story");
  const tCategories = useTranslations("categories");
  const tContact = useTranslations("contact");
  const tA11y = useTranslations("a11y");

  // These two links are pinned dir="ltr" so the phone number/email always
  // read left-to-right; their text-align is driven by the actual page
  // direction rather than Tailwind's rtl:/ltr: variants, which key off of
  // this same overridden `dir` attribute.
  const numeralAlign = isRtlLocale(useLocale()) ? "text-right" : "text-left";

  const hoverable = useMediaQuery("(hover: hover) and (pointer: fine)");
  const showPreview = useMediaQuery("(min-width: 1024px)");

  const panelRef = useRef<HTMLDivElement>(null);
  const [activeKey, setActiveKey] = useState<MegaMenuGroup["key"]>(
    megaMenu[0].key,
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameState>({
    current: null,
    previous: null,
  });

  const activeGroup =
    megaMenu.find((group) => group.key === activeKey) ?? megaMenu[0];
  const targetId = previewId ?? activeGroup.id;

  const selectGroup = useCallback((key: MegaMenuGroup["key"]) => {
    setActiveKey(key);
    setPreviewId(null);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // `inert` comes off in this same commit, so the rail is already
    // focusable — moving focus into it is what keeps Tab and Escape
    // inside the menu rather than in the page behind it. Scoped to the
    // rail rather than the first control in the overlay, which is the
    // close button: that belongs early in the tab order but is not where
    // a reader wants to land.
    panelRef.current
      ?.querySelector<HTMLElement>(
        "[data-menu-rail] button, [data-menu-rail] a[href]",
      )
      ?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  // Come back to rest only after the fade-out, so the next open starts on
  // the first entry and wipes its photo in, rather than showing whatever
  // was last hovered already sitting in place.
  useEffect(() => {
    if (open) return;

    const timer = window.setTimeout(() => {
      setActiveKey(megaMenu[0].key);
      setPreviewId(null);
      setFrames({ current: null, previous: null });
    }, CLOSE_MS);

    return () => window.clearTimeout(timer);
  }, [open]);

  // Promoted a frame late on purpose: one marked `current` in the very
  // commit it mounts in has no clipped state to transition *from*, and
  // the wipe would be skipped.
  useEffect(() => {
    if (!open || !showPreview) return;

    const raf = requestAnimationFrame(() =>
      setFrames((previous) =>
        previous.current === targetId
          ? previous
          : { current: targetId, previous: previous.current },
      ),
    );

    return () => cancelAnimationFrame(raf);
  }, [open, showPreview, targetId]);

  /**
   * Captions come from whichever namespace the frame is tagged with, so
   * next-intl still sees a narrow literal key (see global.d.ts) instead
   * of an assembled string it can no longer check.
   */
  const captionFor = (frame: MenuFrame) => {
    switch (frame.kind) {
      case "group":
        return {
          eyebrow: tMenu(`${frame.key}.eyebrow`),
          title: tMenu(`${frame.key}.caption`),
        };
      case "story":
        return {
          eyebrow: tStory(`${frame.entry}.index`),
          title: tStory(`${frame.entry}.title`),
        };
      case "category":
        return {
          eyebrow: tCategories(`${frame.category}.kicker`),
          title: tCategories(`${frame.category}.name`),
        };
    }
  };

  const labelFor = (link: MegaMenuLink) =>
    link.kind === "story"
      ? tStory(`${link.entry}.title`)
      : tCategories(`${link.category}.name`);

  const currentFrame = menuFrames.find((frame) => frame.id === frames.current);
  const currentCaption = currentFrame ? captionFor(currentFrame) : null;

  // Mount the photography on the first hint that the menu might open, and
  // only at the sizes that actually show it.
  const mountFrames = showPreview && (armed || open);

  return (
    // Near-opaque rather than translucent-and-blurred: at this alpha a
    // `backdrop-filter` has nothing left to show, and a fullscreen one
    // over a playing hero video is the single most expensive thing this
    // page could composite.
    <div
      id="site-navigation"
      ref={panelRef}
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-rr-black/[0.985] transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        open
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
    >
      {/* `fixed`, not `absolute`: the overlay is the scroll container on a
          phone, and the close button has to stay put while the menu
          scrolls under it. Opacity comes from the overlay — a plain
          `opacity` ancestor is not a containing block for fixed
          positioning, so this still resolves against the viewport. First
          in the tab order, though focus on open goes to the rail. */}
      <button
        type="button"
        data-cursor="interactive"
        onClick={onClose}
        aria-label={tA11y("closeMenu")}
        className="fixed top-5 end-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-rr-hairline-strong text-rr-ink transition-colors hover:border-rr-ink sm:top-7 sm:end-7"
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        >
          <path d="M1 1 15 15M15 1 1 15" />
        </svg>
      </button>

      {/* Two equal halves from `lg` up, and deliberately *not* inside a
          centred max-width container: the photograph has to reach the
          viewport's own edges — top, bottom and outer side — for the split
          to read as one, which it cannot do from inside a padded column.
          So the grid runs full-bleed and each half carries its own
          padding instead. */}
      <div
        key={openId}
        className="grid min-h-full grid-cols-1 lg:grid-cols-2"
      >
        {/* Vertical alignment lives here rather than on the grid, which
            keeps its default `stretch` so the photograph fills its half.
            `justify-start` while the columns are stacked: there the detail
            column's height is part of the total, and centring would
            re-centre the whole menu every time a group with a different
            number of children opened — sliding the rail out from under the
            pointer that had just opened it. From `sm` up the rail is always
            the taller of the two columns, so the height stops moving and
            centring is safe. */}
        <div className="relative flex flex-col justify-start px-6 pt-24 pb-16 sm:justify-center sm:px-10 lg:px-10 xl:ps-20 xl:pe-16">
          {/* The same photograph again, blurred, so this half carries the
              light and colour of the one opposite instead of sitting on
              flat black. Clipped by the wrapper; the wash itself is scaled
              past that clip so its blurred edges land outside it. */}
          {mountFrames && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="rr-menu-wash absolute inset-0">
                <FrameStack frames={frames} />
              </div>
            </div>
          )}

          <div className="relative flex w-full flex-col gap-10 2xl:max-w-3xl">
            {/* The `lg` band is the tight one — a hard half of a 1024px
                viewport leaves the two columns ~420px between them — so the
                rail narrows and both type sizes step down for it, then step
                back up at `xl`. Without that the two-word collection names
                wrap onto second lines. */}
            <div className="flex flex-col gap-10 sm:flex-row sm:gap-12 lg:gap-8 xl:gap-14">
              <nav
                data-menu-rail
                aria-label={tA11y("primaryNav")}
                className="flex shrink-0 flex-col sm:w-[47%] lg:w-[42%] xl:w-[40%]"
              >
                <span
                  className="rr-menu-item mb-6 text-[11px] tracking-[0.3em] text-rr-faint uppercase"
                  style={stagger(0)}
                >
                  {tMenu("index")}
                </span>

                <ul className="flex flex-col">
                  {megaMenu.map((group, index) => {
                    const isActive = group.key === activeKey;
                    const activate = () => selectGroup(group.key);
                    const railClassName =
                      "flex w-full items-start gap-4 py-2.5 text-start";
                    const railLabel = (
                      <>
                        <span className="w-5 shrink-0 pt-2 text-[10px] tracking-[0.2em] text-rr-faint tabular-nums">
                          {`0${index + 1}`}
                        </span>
                        <span
                          className={`relative text-2xl leading-tight font-light tracking-wide transition-colors duration-300 sm:text-3xl lg:text-2xl xl:text-3xl ${
                            isActive ? "text-rr-ink" : "text-rr-ink/45"
                          }`}
                        >
                          {tNav(group.key)}
                          <span
                            aria-hidden
                            className={`absolute inset-x-0 -bottom-1 h-px origin-left bg-rr-ink/60 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] rtl:origin-right ${
                              isActive ? "scale-x-100" : "scale-x-0"
                            }`}
                          />
                        </span>
                      </>
                    );

                    return (
                      <li
                        key={group.key}
                        className="rr-menu-item"
                        style={stagger(index + 1)}
                      >
                        {group.children.length > 0 ? (
                          // Entries with sub-navigation expand rather than
                          // navigate; the detail column carries the link to
                          // the section itself.
                          <button
                            type="button"
                            data-cursor="interactive"
                            aria-expanded={isActive}
                            aria-controls="site-navigation-detail"
                            onClick={activate}
                            onFocus={activate}
                            onPointerEnter={hoverable ? activate : undefined}
                            className={railClassName}
                          >
                            {railLabel}
                          </button>
                        ) : (
                          <a
                            href={group.href}
                            data-cursor="interactive"
                            onClick={onClose}
                            onFocus={activate}
                            onPointerEnter={hoverable ? activate : undefined}
                            className={railClassName}
                          >
                            {railLabel}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <nav
                id="site-navigation-detail"
                aria-label={tA11y("menuDetail")}
                className="sm:flex-1"
              >
                {/* Keyed on the active entry so its column rises in afresh. */}
                <div
                  key={activeGroup.key}
                  className="flex flex-col items-start gap-6"
                >
                  <span
                    className="rr-menu-item text-[11px] tracking-[0.3em] text-rr-faint uppercase"
                    style={stagger(0)}
                  >
                    {tMenu(`${activeGroup.key}.eyebrow`)}
                  </span>

                  {activeGroup.children.length > 0 ? (
                    <ul className="flex flex-col gap-4">
                      {activeGroup.children.map((child, index) => (
                        <li
                          key={child.id}
                          className="rr-menu-item"
                          style={stagger(index + 1)}
                        >
                          <a
                            href={child.href}
                            data-cursor="interactive"
                            onClick={onClose}
                            onFocus={() => setPreviewId(child.id)}
                            onBlur={() => setPreviewId(null)}
                            onPointerEnter={
                              hoverable ? () => setPreviewId(child.id) : undefined
                            }
                            onPointerLeave={
                              hoverable ? () => setPreviewId(null) : undefined
                            }
                            className="group/link flex items-center gap-3 text-sm tracking-[0.15em] text-rr-muted uppercase transition-colors hover:text-rr-ink lg:text-[13px] xl:text-sm"
                          >
                            <span
                              aria-hidden
                              className="h-px w-0 bg-current transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/link:w-6 group-focus-visible/link:w-6"
                            />
                            {labelFor(child)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      className="rr-menu-item max-w-[24ch] text-sm leading-relaxed text-rr-muted"
                      style={stagger(1)}
                    >
                      {tMenu(`${activeGroup.key}.caption`)}
                    </p>
                  )}

                  <a
                    href={activeGroup.href}
                    data-cursor="interactive"
                    onClick={onClose}
                    style={stagger(activeGroup.children.length + 2)}
                    className="rr-menu-item mt-2 inline-flex items-center gap-2 text-[11px] tracking-[0.25em] text-rr-faint uppercase transition-colors hover:text-rr-ink"
                  >
                    {tMenu("viewSection")}
                    <span aria-hidden className="rtl:-scale-x-100">
                      →
                    </span>
                  </a>
                </div>
              </nav>
            </div>

            <div className="flex flex-col gap-3 border-t border-rr-hairline pt-8 text-sm text-rr-muted">
              <a
                href={contactLinks.phoneHref}
                data-cursor="interactive"
                dir="ltr"
                style={stagger(megaMenu.length + 1)}
                className={`rr-menu-item transition-colors hover:text-rr-ink ${numeralAlign}`}
              >
                {tContact("phone")}
              </a>
              <a
                href={contactLinks.emailHref}
                data-cursor="interactive"
                dir="ltr"
                style={stagger(megaMenu.length + 2)}
                className={`rr-menu-item transition-colors hover:text-rr-ink ${numeralAlign}`}
              >
                {tContact("email")}
              </a>
              <div className="rr-menu-item" style={stagger(megaMenu.length + 3)}>
                <LocaleSwitcher className="pt-2" />
              </div>
            </div>
          </div>
        </div>

        {showPreview && (
          // No height, no frame: the figure is a grid cell in a row that
          // already fills the viewport, so it reaches the top, bottom and
          // outer edge on its own. Only the inner edge is drawn, as a
          // hairline — without it a photograph as dark as the fabric one
          // would dissolve into the black half beside it.
          <figure
            aria-hidden
            className="relative overflow-hidden border-s border-rr-hairline bg-rr-panel"
          >
            {mountFrames && <FrameStack frames={frames} />}

            {/* Two scrims rather than one: the floating header pill now
                overhangs the photograph, and the caption sits on it. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-40 bg-gradient-to-b from-rr-black/60 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-2/5 bg-gradient-to-t from-rr-black/85 to-transparent" />

            {currentCaption && (
              // Keyed on the frame so the caption rises in with its photo.
              <figcaption
                key={frames.current}
                className="absolute inset-x-0 bottom-0 z-[4] p-10 xl:p-14"
              >
                <span
                  className="rr-menu-item block text-[10px] tracking-[0.3em] text-rr-faint uppercase"
                  style={stagger(0)}
                >
                  {currentCaption.eyebrow}
                </span>
                <span
                  className="rr-menu-item mt-2 block text-lg font-light tracking-[0.12em] text-rr-ink uppercase"
                  style={stagger(1)}
                >
                  {currentCaption.title}
                </span>
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </div>
  );
}
