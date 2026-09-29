import type { CharacterClass } from '@mythicplus/shared';
import type { ChannelData, WoWPlayer } from '../types';

/** What a bad-group report is built from: the finished round and who filed it. */
export interface BadGroupReportInput {
  title: string;
  description: string;
  reporterName: string | null;
  reporterId: string | null;
  lobby: ChannelData;
  /** Fallback for the report's player list when the round has no groups. */
  lobbyPlayers: readonly WoWPlayer[];
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
  revealAllGroups(channelId: string, groupCount: number): Promise<void>;
  finishSequence(channelId: string): Promise<void>;
  newRound(channelId: string): Promise<void>;
  cancelToLobby(channelId: string): Promise<void>;
  saveRoles(playerId: string, roles: string[], inGameName: string): Promise<void>;
  saveLinkedCharacter(playerId: string, linkedCharacter: { name: string; realm: string; region: string }, mediaUrl?: string | null, characterClass?: CharacterClass | null): Promise<void>;
  refreshChannels(guildId: string): Promise<void>;
  selectChannel(channelId: string, channelName: string, guildId: string): Promise<void>;
  reportBadGroup(report: BadGroupReportInput): Promise<void>;
  claimPlayer(channelId: string, playerId: string): Promise<void>;
  unclaimPlayer(channelId: string, playerId: string): Promise<void>;
  setSittingOut(channelId: string, discordId: string, sittingOut: boolean): Promise<void>;
}
