import { useCallback, useSyncExternalStore } from "react";

interface NetworkInformation extends EventTarget {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  saveData?: boolean;
}

function getConnection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation })
    .connection;
}

/**
 * Reports whether the visitor is on a connection too slow (or too costly)
 * to justify the hero video's ~4MB fetch: 2G/slow-2G, or Data Saver mode.
 *
 * Built on useSyncExternalStore like useMediaQuery: `false` on the server
 * and the initial client render (so there's no hydration mismatch — SSR
 * has no way to know the visitor's connection), reconciling to the real
 * value immediately after mount. The Network Information API is
 * Chromium-only; everywhere else this permanently reads `false` — i.e. we
 * only ever *skip* the video on evidence of a slow connection, never on
 * absence of the API.
 */
export function useSlowConnection(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const connection = getConnection();
    if (!connection) return () => {};
    connection.addEventListener("change", onChange);
    return () => connection.removeEventListener("change", onChange);
  }, []);

  const getSnapshot = useCallback(() => {
    const connection = getConnection();
    if (!connection) return false;
    return (
      connection.saveData === true ||
      connection.effectiveType === "slow-2g" ||
      connection.effectiveType === "2g"
    );
  }, []);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
