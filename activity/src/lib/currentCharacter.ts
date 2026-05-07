import type { CharacterClass } from '@mythicplus/shared';
import { toCharacterClass } from '@mythicplus/shared';

export const CHARACTER_KEY = 'wheelson-character';
export const DISCORD_ID_KEY = 'wheelson-discord-id';
const LEGACY_PREFIX = 'wheelson-player-';

export type CharacterLookupStatus = 'pending' | 'ok' | 'not_found' | 'no_name';

export interface StoredCharacter {
  inGameName: string;
  region: string;
  mediaUrl: string | null;
  characterClass: CharacterClass | null;
  lookupStatus: CharacterLookupStatus;
  lastUpdated: number;
}

const VALID_STATUSES: ReadonlySet<CharacterLookupStatus> = new Set([
  'pending', 'ok', 'not_found', 'no_name',
]);

function isStoredCharacter(value: unknown): value is StoredCharacter {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.inGameName === 'string' &&
    typeof v.region === 'string' &&
    (v.mediaUrl === null || typeof v.mediaUrl === 'string') &&
    (v.characterClass === null || toCharacterClass(v.characterClass) !== null) &&
    typeof v.lookupStatus === 'string' &&
    VALID_STATUSES.has(v.lookupStatus as CharacterLookupStatus) &&
    typeof v.lastUpdated === 'number'
  );
}

export function loadStoredCharacter(): StoredCharacter | null {
  const raw = localStorage.getItem(CHARACTER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isStoredCharacter(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredCharacter(character: StoredCharacter): void {
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(character));
}

export function clearStoredCharacter(): void {
  localStorage.removeItem(CHARACTER_KEY);
}

export function loadStoredDiscordId(): string | null {
  return localStorage.getItem(DISCORD_ID_KEY);
}

export function saveStoredDiscordId(discordId: string): void {
  localStorage.setItem(DISCORD_ID_KEY, discordId);
}

/**
 * Convert a realm display name to its slug form (lowercase, dash-separated,
 * no apostrophes). E.g. `"Kel'Thuzad"` → `"kelthuzad"`, `"Area 52"` → `"area-52"`.
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
export function parseInGameName(input: string | undefined | null): { name: string; realmSlug: string } | null {
  if (!input) return null;
  const trimmed = input.trim();
  const dashIdx = trimmed.indexOf('-');
  if (dashIdx === -1) return null;
  const name = trimmed.slice(0, dashIdx).trim();
  const realm = trimmed.slice(dashIdx + 1).trim();
  if (!name || !realm) return null;
  return { name, realmSlug: realmToSlug(realm) };
}

/**
 * One-shot migration of legacy per-guild Discord ID keys into the new global
 * key. Called once on app boot. No-op when the new key already exists or
 * there are no legacy keys. Does not delete legacy keys — they're harmless
 * leftovers.
 */
export function migrateLegacyDiscordId(): void {
  if (localStorage.getItem(DISCORD_ID_KEY)) return;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LEGACY_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) {
        localStorage.setItem(DISCORD_ID_KEY, value);
        return;
      }
    }
  }
}
