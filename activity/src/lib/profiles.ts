import {
  WoWPlayer as Player,
  parseInGameName,
  parsePlayerPreferences,
  type LobbyMember,
  type PlayerPreferences,
} from '@mythicplus/shared';
import type { WoWPlayer } from '../types';
import { playerRolesToStringArray } from './roles';

/**
 * preferences docs by Discord ID. `null` means the doc was looked up and
 * doesn't exist (the player never set a profile); a missing key means it
 * hasn't loaded yet.
 */
export type Profiles = Record<string, PlayerPreferences | null>;

/**
 * The lobby roster: each voice member joined with their preferences doc.
 * Every view reads this list; nothing stores player dicts on the lobby doc.
 */
export function joinPlayers(members: readonly LobbyMember[], profiles: Profiles): WoWPlayer[] {
  return members.map((m) => Player.fromPreferences(m, profiles[m.discordId] ?? null).toDict());
}

/** The inverse of `joinPlayers`, for demo mode and test fixtures written as player lists. */
export function splitPlayers(players: readonly WoWPlayer[]): { members: LobbyMember[]; profiles: Profiles } {
  const members: LobbyMember[] = [];
  const profiles: Profiles = {};
  for (const p of players) {
    members.push({ discordId: p.discordId, name: p.name });
    profiles[p.discordId] = parsePlayerPreferences({
      roles: playerRolesToStringArray(p),
      inGameName: p.inGameName,
      mediaUrl: p.mediaUrl,
      characterClass: p.characterClass,
    });
  }
  return { members, profiles };
}

/** True while this lobby member's preferences doc hasn't loaded yet. */
export function isProfileLoading(
  discordId: string | null,
  players: readonly WoWPlayer[],
  profiles: Profiles,
): boolean {
  return !!discordId && players.some((p) => p.discordId === discordId) && !(discordId in profiles);
}

/**
 * True when a profile names a character but has no portrait, which a lookup
 * can fill in. Older versions of the activity left some profiles like this.
 */
export function needsPortraitRepair(profile: PlayerPreferences | null | undefined): profile is PlayerPreferences {
  return !!profile && !profile.mediaUrl && parseInGameName(profile.inGameName) !== null;
}
