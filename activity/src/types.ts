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

export interface Session {
  guildId: string;
  channelId: string;
  status: 'lobby' | 'request_spin' | 'spinning' | 'completed';
  players: WoWPlayer[];
  groups: WoWGroup[];
  createdAt: any; // Firestore Timestamp
}
