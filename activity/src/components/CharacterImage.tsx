import { useState, type ReactNode } from 'react';
import { remapImageUrl } from '../discordSdk';
import { toAvatarUrl, toMainBodyUrl } from '../lib/characterMedia';

interface CharacterImageProps {
  mediaUrl: string | null | undefined;
  /** `avatar` for head shots, `body` for the full-body portrait. */
  variant: 'avatar' | 'body';
  className?: string;
  alt?: string;
  /** Rendered when there is no image or it fails to load. */
  fallback?: ReactNode;
}

/**
 * The one place a Blizzard character render becomes an <img>: picks the
 * variant, routes it through Discord's activity proxy, and swaps in `fallback`
 * when the render is missing (Blizzard answers 403 for characters it has
 * never rendered).
 */
export function CharacterImage({ mediaUrl, variant, className, alt = '', fallback = null }: CharacterImageProps) {
  const src = remapImageUrl(variant === 'avatar' ? toAvatarUrl(mediaUrl) : toMainBodyUrl(mediaUrl));
  // Keyed by src so a new URL gets a fresh attempt without an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || src === failedSrc) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} />;
}
