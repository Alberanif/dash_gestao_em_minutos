"use client";

import { useCallback, useSyncExternalStore } from "react";

// true quando a media query casa com a viewport atual. SSR e ambientes sem
// matchMedia (jsdom dos testes) resolvem para false — quem consome deve
// tratar false como o layout desktop/padrão.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(query).matches
        : false,
    () => false
  );
}
