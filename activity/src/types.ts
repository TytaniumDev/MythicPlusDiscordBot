export interface WheelEntry {
  name: string;
  isOffspec: boolean;
}

export interface WoWPlayer {
  name: string;
  discordId?: string;
  roles: {
    tankMain: boolean;
    healerMain: boolean;
    dpsMain: boolean;
    offtank: boolean;
    offhealer: boolean;
    offdps: boolean;
    offranged: boolean;
    offmelee: boolean;
    ranged: boolean;
    melee: boolean;
    hasBrez: boolean;
    hasLust: boolean;
  };
}

export interface WoWGroup {
  tank: WoWPlayer | null;
  healer: WoWPlayer | null;
  dps: WoWPlayer[];
}

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
  refreshRequest?: unknown;
  createdAt: unknown;
  lastActive: unknown;
}

export interface ChannelData {
  channelId: string;
  channelName: string;
  guildId: string;
  status: 'lobby' | 'request_spin' | 'spinning' | 'completed';
  players: WoWPlayer[];
  groups: WoWGroup[];
  revealedGroups?: number;
  refreshPlayers?: boolean;
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
