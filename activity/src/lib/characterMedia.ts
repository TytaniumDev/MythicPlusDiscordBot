/**
 * Blizzard character-media assets all share the same CDN hash — only the
 * suffix/extension changes between the three variants:
 *   <base>-avatar.jpg      head shot, ~84×84
 *   <base>-inset.jpg       3/4 body,  ~200×400 (transparent bg)
 *   <base>-main-raw.png    full body, ~1400×2800 (transparent bg)
 *
 * The bot currently persists the inset URL as `mediaUrl`. This helper
 * rewrites any of the three variants into the requested one, so consumers
 * can pick the right size without a Firestore migration.
 */

const VARIANT_PATTERN = /-(avatar\.jpg|inset\.jpg|main-raw\.png)(\?.*)?$/;

export function toMainBodyUrl(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) return null;
  if (!VARIANT_PATTERN.test(mediaUrl)) return mediaUrl;
  return mediaUrl.replace(VARIANT_PATTERN, '-main-raw.png$2');
}

export function toAvatarUrl(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) return null;
  if (!VARIANT_PATTERN.test(mediaUrl)) return mediaUrl;
  return mediaUrl.replace(VARIANT_PATTERN, '-avatar.jpg$2');
}
