import type { CharacterClass } from '@mythicplus/shared';
import type { WoWPlayer } from '../types';

/** A report that the current round's groups in this lobby look wrong. */
export interface BadGroupReportInput {
  channelId: string;
  title: string;
  description: string;
  reporterName: string | null;
}

export type IssueKind = 'bug' | 'feature';

/** A bug report or feature request. */
export interface IssueReportInput {
  kind: IssueKind;
  title: string;
  description: string;
  reporterName: string | null;
}

/**
 * Everything the activity reads from and writes to its session. Methods take
 * what they act on as arguments; only the subscriptions write to the store.
 */
export interface SessionService {
  /** Follow the guild doc, creating it (and the launch channel's lobby) if it's missing. */
  subscribeToGuild(guildId: string, launchChannelId: string | null): () => void;
  subscribeToChannel(channelId: string): () => void;
  /** Start a round from these players; a no-op when a round has already started. */
  requestSpin(channelId: string, players: readonly WoWPlayer[], seasonSlug: string | null): Promise<void>;
  /** Start the reveal on every screen; a no-op when it has already started. */
  revealAllGroups(channelId: string, groupCount: number): Promise<void>;
  finishSequence(channelId: string): Promise<void>;
  newRound(channelId: string): Promise<void>;
  cancelToLobby(channelId: string): Promise<void>;
  saveRoles(playerId: string, roles: string[], inGameName: string): Promise<void>;
  saveLinkedCharacter(playerId: string, linkedCharacter: { name: string; realm: string; region: string }, mediaUrl?: string | null, characterClass?: CharacterClass | null): Promise<void>;
  selectChannel(channelId: string, channelName: string, guildId: string): Promise<void>;
  reportBadGroup(report: BadGroupReportInput): Promise<void>;
  /** Needs a Discord sign-in, so Wheelson can DM the reporter when it's resolved. */
  reportIssue(report: IssueReportInput): Promise<void>;
  claimPlayer(channelId: string, playerId: string): Promise<void>;
  unclaimPlayer(channelId: string, playerId: string): Promise<void>;
  setSittingOut(channelId: string, discordId: string, sittingOut: boolean): Promise<void>;
}
