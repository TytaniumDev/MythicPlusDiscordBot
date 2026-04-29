import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const mql = typeof window !== 'undefined' ? window.matchMedia(query) : null;

  return useSyncExternalStore(
    (callback) => {
      mql?.addEventListener('change', callback);
      return () => mql?.removeEventListener('change', callback);
    },
    () => mql?.matches ?? false,
    () => false,
  );
}

export function useIsCarouselMode(): boolean {
  return useMediaQuery('(max-width: 599px)');
}

export function useIsCompactPanel(): boolean {
  return useMediaQuery('(max-width: 899px)');
}

/** Use mobile drawer layout for lobby (at tablet breakpoint and below) */
export function useIsMobileLobby(): boolean {
  return useMediaQuery('(max-width: 899px)');
}

/**
 * True when the viewport is wide enough to escape carousel mode but
 * portrait-ish (aspect ratio < 1.2:1). At these dimensions the Groups
 * panel docks to the bottom of the wheels view as a horizontal strip.
 * The 6/5 threshold matches the corresponding CSS rules in index.css.
 */
export function useIsBottomStrip(): boolean {
  return useMediaQuery('(min-width: 600px) and (max-aspect-ratio: 6/5)');
}
