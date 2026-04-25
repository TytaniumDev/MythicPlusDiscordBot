/**
 * Mythic+ key level configuration shared across the app.
 */

export const KEY_LEVEL_MIN = 2;
export const KEY_LEVEL_MAX = 20;
export const KEY_LEVEL_DEFAULT = 12;

/** Clamp a numeric input into the supported range. Unparseable input
 *  (null, undefined, empty string, NaN, non-numeric strings) falls back to
 *  the default — `Number(null)` and `Number('')` would otherwise silently
 *  coerce to 0 and clamp to KEY_LEVEL_MIN, which loses the "no preference
 *  set yet" intent we get from a missing localStorage key. */
export function clampKeyLevel(level: unknown): number {
  if (level === null || level === undefined) return KEY_LEVEL_DEFAULT;
  if (typeof level === 'string' && level.trim() === '') return KEY_LEVEL_DEFAULT;
  const n = typeof level === 'number' ? level : Number(level);
  if (!Number.isFinite(n)) return KEY_LEVEL_DEFAULT;
  return Math.min(KEY_LEVEL_MAX, Math.max(KEY_LEVEL_MIN, Math.round(n)));
}
