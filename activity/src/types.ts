import type { WoWPlayerDict, WoWGroupDict, SessionStatus } from '@mythicplus/shared';

export interface WheelEntry {
  name: string;
  isOffspec: boolean;
  isChosen?: boolean;
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
    rounds: Record<string, unknown>[][];
  };
  refreshRequest?: unknown;
  createdAt: unknown;
  lastActive: unknown;
}

export interface ChannelData {
  channelId: string;
  channelName: string;
  guildId: string;
  status: SessionStatus;
  players: WoWPlayer[];
  groups: WoWGroup[];
  revealedGroups?: number;
  refreshPlayers?: boolean;
  claimedPlayers?: string[];
  sittingOut?: string[];
  isDebug: boolean;
  announceResults: boolean;
  createdAt: unknown;
  lastActive: unknown;
}

export interface RecentGuild {
  guildId: string;
  guildName: string;
  guildIconUrl?: string;
  lastVisited: number;
}
