# Trends Garments

A Next.js (App Router) + TypeScript rebuild of the Trends Garments marketing
site: the copy and structure come from the original site, restyled in the
dark, editorial design language of rolls-roycemotorcars.com, with a custom
"liquid glass" cursor and full English/Arabic (RTL) internationalization.

## Stack

- **Next.js 16** (App Router, Turbopack, typed routes)
- **TypeScript**, strict mode
- **Tailwind CSS v4**
- **next-intl** for i18n/routing (`/`, `/ar`) — see `i18n/` and `messages/`

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 (English) or http://localhost:3000/ar (Arabic).

```bash
npm run build   # production build + typecheck
npm run lint    # ESLint
```

## Project structure

```
app/[locale]/       Root layout + the single home page
components/
  cursor/           The liquid-glass cursor (LiquidGlassCursor + its SVG filter)
  layout/           Header, fullscreen nav overlay, footer, locale switcher
  sections/         Hero, split panels, category grid, story blocks, contact
  ui/               Small shared primitives (scroll-reveal, category icons)
i18n/               next-intl routing, navigation helpers, request config
lib/content.ts      Structural content (image URLs, hrefs, category order)
messages/           en.json / ar.json — all translatable copy
```

## Adding a locale

1. Add the locale code to `i18n/routing.ts` (`locales`, and `rtlLocales` if
   it reads right-to-left).
2. Copy `messages/en.json` to `messages/<locale>.json` and translate every
   key — the TypeScript types in `global.d.ts` will flag anything missing.

## Adding a uniform category

Add an entry to the `categories` array in `lib/content.ts` (id, icon key,
gradient), a matching icon case in `components/ui/CategoryIcon.tsx`, and a
`categories.<id>` block in every file under `messages/`.
