export interface WheelEntry {
  name: string;
  isOffspec: boolean;
}

export interface WoWPlayer {
  name: string;
  roles: {
    tankMain: boolean;
    healerMain: boolean;
    dpsMain: boolean;
    offtank: boolean;
    offhealer: boolean;
    offdps: boolean;
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
  createdAt: any; // Firestore Timestamp
  lastActive: any;
}

export interface ChannelData {
  channelId: string;
  channelName: string;
  guildId: string;
  status: 'lobby' | 'request_spin' | 'spinning' | 'completed';
  players: WoWPlayer[];
  groups: WoWGroup[];
  isDebug: boolean;
  announceResults: boolean;
  createdAt: any; // Firestore Timestamp
  lastActive: any;
}

export interface RecentGuild {
  guildId: string;
  guildName: string;
  guildIconUrl?: string;
  lastVisited: number;
}
