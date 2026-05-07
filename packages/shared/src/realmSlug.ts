/**
 * Default region used when an explicit region isn't supplied. The activity and
 * functions packages both target US realms — this is the assumed fallback.
 */
export const DEFAULT_REGION = 'us';

/**
 * Convert a realm display name to its slug form (lowercase, dash-separated,
 * no apostrophes). E.g. `"Kel'Thuzad"` → `"kelthuzad"`, `"Area 52"` → `"area-52"`.
 *
 * Apostrophes are stripped entirely; any other non-alphanumeric run collapses
 * to a single hyphen so inputs with stray spacing (e.g. "Azjol - Nerub") still
 * produce a valid slug.
 */
export function realmToSlug(realm: string): string {
  return realm
    .trim()
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parse a "Name-Realm" combined input into the character name and realm slug.
 * Returns null when input has no dash, or either side is empty after trim.
 */
export function parseInGameName(
  input: string | undefined | null,
): { name: string; realmSlug: string } | null {
  if (!input) return null;
  const trimmed = input.trim();
  const dashIdx = trimmed.indexOf('-');
  if (dashIdx === -1) return null;
  const name = trimmed.slice(0, dashIdx).trim();
  const realm = trimmed.slice(dashIdx + 1).trim();
  if (!name || !realm) return null;
  return { name, realmSlug: realmToSlug(realm) };
}
