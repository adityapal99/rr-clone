import Image from "next/image";
import { useTranslations } from "next-intl";
import { storyImages, type StoryEntry } from "@/lib/content";

interface StoryBlockProps {
  entry: StoryEntry;
  /** Position in the sequence; alternates the copy's alignment. */
  index: number;
}

/**
 * One craftsmanship narrative block — a full-bleed photo behind copy, in
 * the spirit of Rolls-Royce's "SERIES II" editorial breaks. Alignment
 * alternates down the sequence so consecutive blocks don't stack flush.
 *
 * Each of these gets its own pinned section (see app/[locale]/page.tsx), so
 * the 01 / 02 / 03 numbering reads as real progress steps on the tape rail.
 */
export function StoryBlock({ entry, index }: StoryBlockProps) {
  const t = useTranslations("story");
  const align = index % 2 === 0 ? "justify-start" : "justify-end";
  const textAlign = index % 2 === 0 ? "text-start" : "text-end";
  const image = storyImages[entry];

  return (
    <div className="absolute inset-0">
      <Image
        src={image.src}
        alt=""
        fill
        sizes="100vw"
        loading="lazy"
        className="object-cover contrast-125 brightness-50"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />

      <div
        className={`relative mx-auto flex h-full w-full max-w-6xl items-center px-6 sm:px-10 ${align}`}
      >
        <div className={`pin-content relative max-w-xl ${textAlign}`}>
          <span className="text-xs tracking-[0.3em] text-rr-faint">
            {t(`${entry}.index`)}
          </span>
          <h2 className="mt-4 text-2xl leading-snug font-light tracking-[0.06em] uppercase sm:text-4xl">
            {t(`${entry}.title`)}
          </h2>
          <p className="mt-6 text-sm leading-relaxed text-rr-muted sm:text-base">
            {t(`${entry}.body`)}
          </p>
        </div>
      </div>
    </div>
  );
}
