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

export interface Session {
  guildId: string;
  channelId?: string; // Legacy/Optional
  status: 'lobby' | 'request_spin' | 'spinning' | 'completed';
  players: WoWPlayer[];
  groups: WoWGroup[];
  voiceChannels?: VoiceChannel[];
  selectedChannelId?: string | null;
  createdAt: any; // Firestore Timestamp
}
