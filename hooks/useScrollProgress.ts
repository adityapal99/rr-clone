"use client";

import { useContext } from "react";
import {
  ScrollProgressContext,
  type ScrollProgressValue,
} from "@/components/scroll/ScrollProgressProvider";

/**
 * Reads the discovered pinned sections and which one is currently active.
 *
 * Note this deliberately does NOT expose the per-frame progress value —
 * that lives in the `--section-progress` / `--rail-progress` CSS custom
 * properties so scrolling never re-renders React. Animate against those
 * in CSS instead of reading progress here.
 */
export function useScrollProgress(): ScrollProgressValue {
  return useContext(ScrollProgressContext);
}
