import { ALL_ROLES, type RoleName } from './config.js';
import { toCharacterClass, type CharacterClass } from './types.js';

/**
 * One person with the lobby's activity open, as the `syncLobbyMembers` Cloud
 * Function writes it to `channels/{channelId}.members`. `name` comes from
 * `lobbyMemberName`. Everything else about the player lives in
 * `preferences/{discordId}`.
 */
export interface LobbyMember {
  discordId: string;
  name: string;
}

/** A Discord user's name as Discord reports it for a server. */
export interface DiscordNames {
  /** The user's nickname in this server. */
  nick?: string | null;
  /** The user's display name. */
  globalName?: string | null;
  username: string;
}

/**
 * The name a lobby shows for a player: their server nickname, else their
 * display name, else their username, with dots stripped.
 */
export function lobbyMemberName({ nick, globalName, username }: DiscordNames): string {
  return (nick || globalName || username).replace(/\./g, '');
}

/**
 * The parts of a `preferences/{discordId}` doc that describe a player. The doc
 * is the single source of truth for a player's profile; the activity reads it
 * through `parsePlayerPreferences`.
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
