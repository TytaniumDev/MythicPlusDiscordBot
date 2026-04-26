/**
 * Mythic+ key level configuration shared across the app.
 */

export const KEY_LEVEL_MIN = 2;
export const KEY_LEVEL_MAX = 20;
export const KEY_LEVEL_DEFAULT = 12;

/** Clamp a numeric input into the supported range. Unparseable input
 *  (null, undefined, empty string, NaN, non-numeric strings) falls back to
 *  the default — `Number(null)` and `Number('')` would otherwise silently
 *  coerce to 0 and clamp to KEY_LEVEL_MIN. */
export function clampKeyLevel(level: unknown): number {
  if (level === null || level === undefined) return KEY_LEVEL_DEFAULT;
  if (typeof level === 'string' && level.trim() === '') return KEY_LEVEL_DEFAULT;
  const n = typeof level === 'number' ? level : Number(level);
  if (!Number.isFinite(n)) return KEY_LEVEL_DEFAULT;
  return Math.min(KEY_LEVEL_MAX, Math.max(KEY_LEVEL_MIN, Math.round(n)));
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Suggested starting key level for a group: the median of each player's
 * median timed-key level, plus one. Returns null when no player has any
 * timed runs to median over — caller falls back to KEY_LEVEL_DEFAULT.
 *
 * Each inner array is one player's per-dungeon best key levels (zeros for
 * un-run dungeons should already be filtered out by the caller).
 */
export function computeSuggestedKeyLevel(
  perPlayerLevels: readonly (readonly number[])[],
): number | null {
  const playerMedians: number[] = [];
  for (const levels of perPlayerLevels) {
    const m = median(levels);
    if (m != null) playerMedians.push(m);
  }
  const groupMedian = median(playerMedians);
  if (groupMedian == null) return null;
  return clampKeyLevel(groupMedian + 1);
}
