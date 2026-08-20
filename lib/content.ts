/**
 * Structural site content: URLs, hrefs and ordering.
 *
 * Anything a human reads lives in /messages/*.json so it can be translated.
 * This file only holds locale-independent data — image sources, anchors,
 * and the stable identifiers that connect a category to its translation key.
 */

export const heroImage = {
  src: "https://cdn1.site-media.eu/images/0/25471112/ChatGPTImageMay9202602_44_45PM-wJf50caTGEPjH4BBWSKEWg.png",
  width: 1920,
  height: 1281,
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

export interface CategoryEntry {
  id: CategoryId;
  href: string;
  /** Icon key rendered by <CategoryIcon />. */
  icon: CategoryId;
  /** Tailwind gradient utility classes — one restrained tone per collection. */
  gradient: string;
}

export const categories: readonly CategoryEntry[] = [
  {
    id: "academic",
    href: "#academic-uniforms",
    icon: "academic",
    gradient: "from-[#1c1c1c] via-[#141414] to-black",
  },
  {
    id: "hospitality",
    href: "#hospitality-uniforms",
    icon: "hospitality",
    gradient: "from-[#1a1712] via-[#151310] to-black",
  },
  {
    id: "healthcare",
    href: "#healthcare-uniforms",
    icon: "healthcare",
    gradient: "from-[#111417] via-[#101112] to-black",
  },
  {
    id: "industrial",
    href: "#industrial-uniforms",
    icon: "industrial",
    gradient: "from-[#151515] via-[#121212] to-black",
  },
  {
    id: "security",
    href: "#security-uniforms",
    icon: "security",
    gradient: "from-[#14151a] via-[#111114] to-black",
  },
] as const;

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
