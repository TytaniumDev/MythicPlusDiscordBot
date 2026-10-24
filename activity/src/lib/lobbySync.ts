import type { LobbyMember } from '@mythicplus/shared';

// When a client asks `syncLobbyMembers` to update the lobby's roster. Every
// client sees the same participants, so they take turns: the lowest Discord
// ID asks at once and the others wait a step each, giving up when the roster
// catches up first.

/** How long each client waits after the one ahead of it. */
export const SYNC_STAGGER_MS = 1500;

/** Sorted, de-duplicated IDs, as a key that is equal for equal sets. */
export function idsKey(ids: readonly string[]): string {
  return [...new Set(ids)].sort().join(',');
}

/** The members' IDs as an `idsKey`. */
export function memberIdsKey(members: readonly LobbyMember[] | undefined): string {
  return idsKey((members ?? []).map((m) => m.discordId));
}

/**
 * True when the lobby's roster is out of date: it lists other people than
 * have the activity open, or it came from an earlier run of the activity.
 */
export function lobbyNeedsSync(
  participantsKey: string,
  membersKey: string,
  lobbyInstanceId: string | null,
  instanceId: string,
): boolean {
  return participantsKey !== membersKey || lobbyInstanceId !== instanceId;
}

/**
 * How long this client waits before asking: its place among the participants
 * times the stagger. A client that doesn't know who it is goes last.
 */
export function syncDelayMs(participantIds: readonly string[], myDiscordId: string | null): number {
  const sorted = [...new Set(participantIds)].sort();
  const rank = myDiscordId ? sorted.indexOf(myDiscordId) : -1;
  return (rank === -1 ? sorted.length : rank) * SYNC_STAGGER_MS;
}
