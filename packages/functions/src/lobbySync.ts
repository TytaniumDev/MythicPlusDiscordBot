import { isRecord } from '@mythicplus/shared';
import type { LobbyMember } from '@mythicplus/shared';

// The roster logic behind `syncLobbyMembers`: who belongs in a lobby's
// `members`, and what to write when it changes.

export interface LobbySyncRequest {
  channelId: string;
  /** The activity instance the caller is in (the Embedded App SDK's `instanceId`). */
  instanceId: string;
}

/** Validate a `syncLobbyMembers` request; null when a field is missing or malformed. */
export function parseLobbySyncRequest(data: unknown): LobbySyncRequest | null {
  if (!isRecord(data)) return null;
  const { channelId, instanceId } = data;
  if (typeof channelId !== 'string' || !/^[0-9]{1,32}$/.test(channelId)) return null;
  if (typeof instanceId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(instanceId)) return null;
  return { channelId, instanceId };
}

/** Shown for someone Discord has no name for. */
export const UNKNOWN_NAME = 'Unknown player';

/**
 * The lobby's members for the users with the activity open. Members who are
 * still there keep their place and name; newcomers follow in Discord's order,
 * named from `names`.
 */
export function rosterFor(
  userIds: readonly string[],
  current: readonly LobbyMember[],
  names: ReadonlyMap<string, string>,
): LobbyMember[] {
  const open = new Set(userIds);
  const kept = current.filter((m) => open.has(m.discordId));
  const known = new Set(kept.map((m) => m.discordId));
  const added = [...open]
    .filter((id) => !known.has(id))
    .map((discordId) => ({ discordId, name: names.get(discordId) ?? UNKNOWN_NAME }));
  return [...kept, ...added];
}

/** The users the lobby doesn't have a name for yet. */
export function newcomers(userIds: readonly string[], current: readonly LobbyMember[]): string[] {
  const known = new Set(current.map((m) => m.discordId));
  return [...new Set(userIds)].filter((id) => !known.has(id));
}

function sameMembers(a: readonly LobbyMember[], b: readonly LobbyMember[]): boolean {
  return a.length === b.length
    && a.every((m, i) => m.discordId === b[i].discordId && m.name === b[i].name);
}

/** A lobby is deleted by its TTL policy this long after its last sync. */
export const LOBBY_TTL_MS = 24 * 60 * 60 * 1000;
/** Push the expiry out once less than this much of it is left. */
const EXPIRY_REFRESH_MS = 12 * 60 * 60 * 1000;

export interface LobbySyncState {
  members: LobbyMember[];
  instanceId: string | null;
  expireAt: Date | null;
}

/**
 * The fields to write for a sync, or null when the lobby is already current,
 * so a sync that changes nothing doesn't wake every client's listener. A new
 * activity instance means the activity was closed and opened again, so the
 * last session's round is cleared, as it was when the lobby emptied.
 */
export function lobbySyncUpdate(
  lobby: LobbySyncState,
  instanceId: string,
  members: LobbyMember[],
  now: number,
): Record<string, unknown> | null {
  const newInstance = lobby.instanceId !== instanceId;
  const expiring = !lobby.expireAt || lobby.expireAt.getTime() - now < EXPIRY_REFRESH_MS;
  if (!newInstance && !expiring && sameMembers(lobby.members, members)) return null;

  const update: Record<string, unknown> = {
    members,
    instanceId,
    expireAt: new Date(now + LOBBY_TTL_MS),
  };
  if (newInstance) {
    Object.assign(update, { status: 'lobby', groups: [], revealedGroups: 0, sittingOut: [], claimedPlayers: [] });
  }
  return update;
}
