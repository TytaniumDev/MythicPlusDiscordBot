import type {
  WoWPlayerDict,
  WoWGroupDict,
  SessionStatus,
  CharacterClass,
  LobbyMember,
  SeasonPairs,
} from '@mythicplus/shared';

export type { SeasonPairs };

export interface WheelEntry {
  name: string;
  isOffspec: boolean;
  isChosen?: boolean;
  mediaUrl: string | null;
  characterClass: CharacterClass | null;
}

export type WoWPlayer = WoWPlayerDict;
export type WoWGroup = WoWGroupDict;

export interface VoiceChannel {
  id: string;
  name: string;
  userCount: number;
}

export interface GuildData {
  guildId: string;
  guildName?: string;
  guildIconUrl?: string;
  voiceChannels: VoiceChannel[];
  groupHistory?: {
    date: string;
    // Stored as either flat `Record<string, unknown>[][]` (legacy) or
    // `{ groups: Record<string, unknown>[] }[]` (current). Always read
    // through parseExistingRounds() in firestoreService.ts to normalize.
    rounds: unknown[];
  };
  seasonPairs?: SeasonPairs;
  refreshRequest?: unknown;
  createdAt: unknown;
  lastActive: unknown;
}

export interface ChannelData {
  channelId: string;
  channelName: string;
  guildId: string;
  status: SessionStatus;
  /** Who is in the voice channel. Written only by the bot; absent until it does. */
  members?: LobbyMember[];
  groups: WoWGroup[];
  revealedGroups?: number;
  claimedPlayers?: string[];
  sittingOut?: string[];
  staticWheel?: boolean;
  isDebug: boolean;
  createdAt: unknown;
  lastActive: unknown;
}

export interface RecentGuild {
  guildId: string;
  guildName: string;
  guildIconUrl?: string;
  lastVisited: number;
}

export interface SeasonConfig {
  slug: string;
  blizzardSeasonId: number;
  expansionId: number;
}

