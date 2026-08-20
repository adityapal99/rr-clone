import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe media query reader built on useSyncExternalStore: returns
 * `false` on the server and during the initial client render, then
 * reconciles to the real value immediately after mount and stays in
 * sync with the query for its lifetime. Avoids both hydration
 * mismatches and the "setState in an effect" anti-pattern that a
 * plain `useEffect` + `useState` approach runs into.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
