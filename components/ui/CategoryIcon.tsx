import type { CategoryId } from "@/lib/content";

interface CategoryIconProps {
  id: CategoryId;
  className?: string;
}

/**
 * Minimal single-weight line icons, one per uniform collection.
 * Drawn at a shared 48x48 viewBox so they align inside the collection tiles.
 */
export function CategoryIcon({ id, className }: CategoryIconProps) {
  const common = {
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (id) {
    case "academic":
      return (
        <svg {...common}>
          <path d="M24 14 4 22l20 8 20-8-20-8Z" />
          <path d="M14 26v8c0 2.2 4.5 4 10 4s10-1.8 10-4v-8" />
          <path d="M40 22v11" />
        </svg>
      );
    case "hospitality":
      return (
        <svg {...common}>
          <path d="M8 30h32" />
          <path d="M24 30V17" />
          <path d="M24 17c-6 0-11-4.5-11-9 6 0 11 3 11 9Z" />
          <path d="M24 17c6 0 11-4.5 11-9-6 0-11 3-11 9Z" />
          <path d="M14 36h20l-2 -6H16Z" />
        </svg>
      );
    case "healthcare":
      return (
        <svg {...common}>
          <path d="M24 8v14M17 15h14" />
          <path d="M14 15h-2a4 4 0 0 0-4 4v13a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V19a4 4 0 0 0-4-4h-2" />
          <path d="M20 29h8M24 25v8" />
        </svg>
      );
    case "industrial":
      return (
        <svg {...common}>
          <path d="M6 38V22l9 6v-6l9 6v-6l9 6v-6l9 6v10Z" />
          <path d="M6 38h36" />
        </svg>
      );
    case "security":
      return (
        <svg {...common}>
          <path d="M24 6c5 3 9 4 15 4 0 16-6 24-15 32-9-8-15-16-15-32 6 0 10-1 15-4Z" />
          <path d="M18 24l4.5 4.5L31 19" />
        </svg>
      );
    default:
      return null;
  }
}
