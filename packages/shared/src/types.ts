export type SessionStatus = 'lobby' | 'request_spin' | 'spinning' | 'completed';

export type Role = 'tank' | 'healer' | 'ranged' | 'melee';
export type Utility = 'brez' | 'lust';

export interface WoWPlayerDict {
  [key: string]: unknown;
  name: string;
  discordId: string;
  mainRole: Role | null;
  offspecs: Role[];
  utilities: Utility[];
}

export interface WoWGroupDict {
  [key: string]: unknown;
  tank: WoWPlayerDict | null;
  healer: WoWPlayerDict | null;
  dps: WoWPlayerDict[];
}
