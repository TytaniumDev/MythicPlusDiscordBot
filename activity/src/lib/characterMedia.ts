/**
 * Blizzard character-media assets all share the same render path — only the
 * suffix/extension changes between the variants:
 *   <base>-avatar.jpg      head shot, 84×84
 *   <base>-inset.jpg       bust with background, 230×116
 *   <base>-main-raw.png    full body, 1600×1200 (transparent bg)
 *
 * `mediaUrl` may hold any of them (older docs store inset; the lookup function
 * now stores avatar), so render through these helpers rather than using it
 * directly. Never display inset: Blizzard stopped regenerating it in mid-2026.
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
