import { useSyncExternalStore } from 'react';

function useMediaQuery(query: string): boolean {
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
