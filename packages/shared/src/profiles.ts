import { ALL_ROLES, type RoleName } from './config.js';
import { toCharacterClass, type CharacterClass } from './types.js';

/**
 * One person in a lobby's voice channel, as the bot writes it to
 * `channels/{channelId}.members`. `name` is the Discord display name with dots
 * stripped. Everything else about the player lives in `preferences/{discordId}`.
 */
export interface LobbyMember {
  discordId: string;
  name: string;
}

/**
 * The parts of a `preferences/{discordId}` doc that describe a player. The doc
 * is the single source of truth for a player's profile; the bot and the
 * activity both read it through `parsePlayerPreferences`.
 */
export interface PlayerPreferences {
  roles: RoleName[];
  inGameName: string;
  mediaUrl: string | null;
  characterClass: CharacterClass | null;
}

function toRoleName(raw: unknown): RoleName | null {
  return typeof raw === 'string' && (ALL_ROLES as readonly string[]).includes(raw)
    ? (raw as RoleName)
    : null;
}

/** Validate a raw `preferences` doc. Unknown roles and malformed fields are dropped. */
export function parsePlayerPreferences(raw: unknown): PlayerPreferences {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const roles = Array.isArray(data.roles)
    ? data.roles.map(toRoleName).filter((r): r is RoleName => r !== null)
    : [];
  return {
    roles,
    inGameName: typeof data.inGameName === 'string' ? data.inGameName : '',
    mediaUrl: typeof data.mediaUrl === 'string' && data.mediaUrl ? data.mediaUrl : null,
    characterClass: toCharacterClass(data.characterClass),
  };
}

/** Validate a raw `channels/{id}.members` value. Malformed entries are dropped. */
export function parseLobbyMembers(raw: unknown): LobbyMember[] {
  if (!Array.isArray(raw)) return [];
  const members: LobbyMember[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { discordId, name } = entry as Record<string, unknown>;
    if (typeof discordId === 'string' && discordId && typeof name === 'string') {
      members.push({ discordId, name });
    }
  }
  return members;
}
