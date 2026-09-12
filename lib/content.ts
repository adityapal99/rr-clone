/**
 * Structural site content: URLs, hrefs and ordering.
 *
 * Anything a human reads lives in /messages/*.json so it can be translated.
 * This file only holds locale-independent data — image sources, anchors,
 * and the stable identifiers that connect a category to its translation key.
 */

// Poster/fallback frame shown before the hero video loads, when
// prefers-reduced-motion skips the video entirely, or if it fails to load.
// Source: Pexels photo 4621891 (pexels.com/photo/4621891) — Pexels License,
// free to use, no attribution required.
export const heroImage = {
  src: "/images/hero-poster.jpg",
  width: 1920,
  height: 1280,
} as const;

// Source: Pexels video 4621690 (pexels.com/video/4621690) — Pexels License,
// free to use, no attribution required.
export const heroVideo = {
  src: "/video/hero.mp4",
  width: 1366,
  height: 720,
} as const;

export const logoImage = {
  src: "https://cdn1.site-media.eu/images/0/25469961/TRENDSGARMENTS-S_m7ZnIOFLp7vuvWPFUE_A.svg",
  width: 240,
  height: 64,
} as const;

export type CategoryId =
  | "academic"
  | "hospitality"
  | "healthcare"
  | "industrial"
  | "security";

export interface ImageAsset {
  src: string;
  width: number;
  height: number;
}

export interface CategoryEntry {
  id: CategoryId;
  href: string;
  /** Icon key rendered by <CategoryIcon />. */
  icon: CategoryId;
  /** Tailwind gradient utility classes — one restrained tone per collection. */
  gradient: string;
  /** Background photo shown behind the icon/gradient. */
  image: ImageAsset;
}

// Category photos — all Pexels License (free for commercial use, no
// attribution required): academic 12885700, hospitality 6474537,
// healthcare 6129499, industrial 7006170, security 7714695
// (pexels.com/photo/<id>).
export const categories: readonly CategoryEntry[] = [
  {
    id: "academic",
    href: "#academic-uniforms",
    icon: "academic",
    gradient: "from-[#1c1c1c] via-[#141414] to-black",
    image: { src: "/images/categories/academic.jpg", width: 1200, height: 800 },
  },
  {
    id: "hospitality",
    href: "#hospitality-uniforms",
    icon: "hospitality",
    gradient: "from-[#1a1712] via-[#151310] to-black",
    image: { src: "/images/categories/hospitality.jpg", width: 1200, height: 1800 },
  },
  {
    id: "healthcare",
    href: "#healthcare-uniforms",
    icon: "healthcare",
    gradient: "from-[#111417] via-[#101112] to-black",
    image: { src: "/images/categories/healthcare.jpg", width: 1200, height: 800 },
  },
  {
    id: "industrial",
    href: "#industrial-uniforms",
    icon: "industrial",
    gradient: "from-[#151515] via-[#121212] to-black",
    image: { src: "/images/categories/industrial.jpg", width: 1200, height: 960 },
  },
  {
    id: "security",
    href: "#security-uniforms",
    icon: "security",
    gradient: "from-[#14151a] via-[#111114] to-black",
    image: { src: "/images/categories/security.jpg", width: 1200, height: 1600 },
  },
] as const;

/**
 * The two "Crafted Collections" / "Tailored Solutions" split-panel photos.
 * Pexels License: products 4862954, services 5830639 (pexels.com/photo/<id>).
 */
export const splitPanelImages: Record<"products" | "services", ImageAsset> = {
  products: { src: "/images/split/products.jpg", width: 1600, height: 2400 },
  services: { src: "/images/split/services.jpg", width: 1600, height: 2400 },
} as const;

/** The three craftsmanship entries, in narrative order. */
export const STORY_ENTRIES = ["precision", "brand", "manufacturing"] as const;

export type StoryEntry = (typeof STORY_ENTRIES)[number];

// Pexels License: precision 11482124, brand 12972006, manufacturing 31112181
// (pexels.com/photo/<id>).
export const storyImages: Record<StoryEntry, ImageAsset> = {
  precision: { src: "/images/story/precision.jpg", width: 1920, height: 1280 },
  brand: { src: "/images/story/brand.jpg", width: 1920, height: 1281 },
  manufacturing: { src: "/images/story/manufacturing.jpg", width: 1920, height: 1280 },
} as const;

export interface NavEntry {
  key: "home" | "about" | "products" | "services" | "contact";
  href: string;
}

export const primaryNav: readonly NavEntry[] = [
  { key: "home", href: "#top" },
  { key: "about", href: "#about" },
  { key: "products", href: "#products" },
  { key: "services", href: "#services" },
  { key: "contact", href: "#contact" },
] as const;

export const contactLinks = {
  phoneHref: "tel:+971509690956",
  emailHref: "mailto:info@trendsgarments.com",
} as const;

/* ---------------------------------------------------------------------
 * Mega menu
 *
 * The overlay navigation is driven entirely from `megaMenu` below, which
 * is derived from `primaryNav` so the top-level entries and their hrefs
 * stay a single source of truth shared with the footer.
 *
 * Every entry — group or child — doubles as a *frame*: one photo in the
 * preview stack, tagged with the message namespace its caption comes
 * from. That tag is what keeps the strongly-typed message keys in
 * global.d.ts intact: the overlay switches on `kind` and calls the
 * matching scoped translator with a narrow union, instead of passing an
 * assembled `string` that next-intl could no longer check.
 * ------------------------------------------------------------------ */

// Mega-menu preview photography, one per top-level entry. All Pexels
// License (free for commercial use, no attribution required): home
// 28460324, about 6765073, products 17315934, services 6764914, contact
// 37697628 (pexels.com/photo/<id>).
export const menuImages: Record<NavEntry["key"], ImageAsset> = {
  home: { src: "/images/menu/home.jpg", width: 1800, height: 1200 },
  about: { src: "/images/menu/about.jpg", width: 1800, height: 1200 },
  products: { src: "/images/menu/products.jpg", width: 1800, height: 2700 },
  services: { src: "/images/menu/services.jpg", width: 1800, height: 1200 },
  contact: { src: "/images/menu/contact.jpg", width: 1800, height: 2700 },
} as const;

/** A link in the mega menu's detail column, and the photo it previews. */
export type MegaMenuLink =
  | {
      kind: "story";
      id: string;
      entry: StoryEntry;
      href: string;
      image: ImageAsset;
    }
  | {
      kind: "category";
      id: string;
      category: CategoryId;
      href: string;
      image: ImageAsset;
    };

/** A top-level entry in the mega menu's rail. */
export interface MegaMenuGroup {
  kind: "group";
  /** Message key in both the `nav` and `menu` namespaces. */
  key: NavEntry["key"];
  id: string;
  href: string;
  image: ImageAsset;
  /** Empty for entries that lead straight to their section. */
  children: readonly MegaMenuLink[];
}

/** Anything the preview panel can show. */
export type MenuFrame = MegaMenuGroup | MegaMenuLink;

// Only two entries expand. The craftsmanship blocks and the collections
// grid each have their own in-page anchors, so their children land
// somewhere distinct; `home`, `services` and `contact` are single
// sections, and inventing sub-links for them would only produce several
// links to one destination.
const menuChildren: Record<NavEntry["key"], readonly MegaMenuLink[]> = {
  home: [],
  about: STORY_ENTRIES.map(
    (entry, index): MegaMenuLink => ({
      kind: "story",
      id: `story-${entry}`,
      entry,
      // Mirrors the section ids in app/[locale]/page.tsx, where the first
      // craftsmanship block carries the shared `#about` anchor.
      href: index === 0 ? "#about" : `#about-${entry}`,
      image: storyImages[entry],
    }),
  ),
  products: categories.map(
    (category): MegaMenuLink => ({
      kind: "category",
      id: `category-${category.id}`,
      category: category.id,
      href: category.href,
      image: category.image,
    }),
  ),
  services: [],
  contact: [],
};

export const megaMenu: readonly MegaMenuGroup[] = primaryNav.map(
  (item): MegaMenuGroup => ({
    kind: "group",
    key: item.key,
    id: `group-${item.key}`,
    href: item.href,
    image: menuImages[item.key],
    children: menuChildren[item.key],
  }),
);

/** Every preview photo the menu can show, in rail order. */
export const menuFrames: readonly MenuFrame[] = megaMenu.flatMap((group) => [
  group,
  ...group.children,
]);
