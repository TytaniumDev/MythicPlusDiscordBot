import type { CharacterClass } from '@mythicplus/shared';
import { toCharacterClass } from '@mythicplus/shared';

// Re-exported for backward compatibility with existing activity callers that
// import these from `lib/currentCharacter`. Canonical implementations live in
// `@mythicplus/shared` (see packages/shared/src/realmSlug.ts).
export { realmToSlug, parseInGameName, DEFAULT_REGION } from '@mythicplus/shared';

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
