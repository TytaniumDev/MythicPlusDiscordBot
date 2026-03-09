export type SessionStatus = 'lobby' | 'request_spin' | 'spinning' | 'completed';

export interface WoWPlayerRolesDict {
  [key: string]: boolean;
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
}

export interface WoWPlayerDict {
  [key: string]: unknown;
  name: string;
  discordId: string;
  roles: WoWPlayerRolesDict;
}

export interface WoWGroupDict {
  [key: string]: unknown;
  tank: WoWPlayerDict | null;
  healer: WoWPlayerDict | null;
  dps: WoWPlayerDict[];
}
