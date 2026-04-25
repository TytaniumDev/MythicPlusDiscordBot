import { useEffect, useRef } from 'react';
import type { WoWPlayer } from '../types';
import { toMainBodyUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';

/**
 * Kick off background fetches for full-body spotlight portraits as soon as
 * players are known. Browsers cache by URL, so the eventual <img> renders in
 * SpotlightPortrait hit cache instead of waiting on Blizzard's CDN.
 */
export function usePreloadPortraits(players: WoWPlayer[] | undefined | null) {
  const preloaded = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!players) return;
    for (const player of players) {
      const mediaUrl = player.mediaUrl;
      if (!mediaUrl || preloaded.current.has(mediaUrl)) continue;
      preloaded.current.add(mediaUrl);
      const url = remapImageUrl(toMainBodyUrl(mediaUrl));
      if (!url) continue;
      const img = new Image();
      img.src = url;
    }
  }, [players]);
}
