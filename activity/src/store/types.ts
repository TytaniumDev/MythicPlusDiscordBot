import { WoWGroup, WheelEntry, GuildData, ChannelData, WoWPlayer, SeasonConfig, SeasonPairs } from '../types';
import type { StoredCharacter } from '../lib/currentCharacter';

export function isCompleteGroup(group: WoWGroup): boolean {
  return group.tank !== null && group.healer !== null && group.dps.length === 3;
}


export type ViewName = 'home' | 'channels' | 'identity' | 'setup' | 'lobby' | 'wheels' | 'results' | 'connections';

export interface AppState {
  // Navigation
  currentView: ViewName;

  // Session
  currentGuildId: string | null;
  currentChannelId: string | null;
  guildData: GuildData | null;
  channelData: ChannelData | null;
  isDemoMode: boolean;
  discordChannelId: string | null;
  guildDocCreationInFlight: boolean;
  seasonConfig: SeasonConfig | null;
  seasonPairs: SeasonPairs | null;

  // Status
  statusMessage: string;

  // Identity
  currentPlayerId: string | null;
  currentPlayerName: string | null;
  identityResolved: boolean;

  // Current-user character (independent of channelData; hydrated from localStorage)
  currentCharacter: StoredCharacter | null;

  // Spin sequence
  fullGroups: WoWGroup[];
  remainderGroups: WoWGroup[];
  currentGroupIndex: number;
  isSpinAnimating: boolean;
  spinSequenceStarted: boolean;

  // Candidate pools
  poolTanks: WheelEntry[];
  poolHealers: WheelEntry[];
  poolDps: WheelEntry[];

  // Side panel group cards
  groupCards: GroupCardData[];

  // Browser back interception for synchronized views
  pendingBrowserBack: boolean;

  // Bumps each time we want consumers to refetch dungeon suggestion data
  // (set when a wheel spin starts). Hooks watch this value to refresh.
  dungeonSuggestionsRefreshKey: number;

  // Actions
  setView: (view: ViewName) => void;
  setGuildId: (id: string | null) => void;
  setChannelId: (id: string | null) => void;
  setGuildData: (data: GuildData | null) => void;
  setChannelData: (data: ChannelData | null) => void;
  setDemoMode: (val: boolean) => void;
  setDiscordChannelId: (id: string | null) => void;
  setGuildDocCreationInFlight: (val: boolean) => void;
  setSeasonConfig: (config: SeasonConfig | null) => void;
  setSeasonPairs: (pairs: SeasonPairs | null) => void;
  setStatusMessage: (msg: string) => void;
  setIdentity: (id: string | null, name: string | null) => void;
  setIdentityResolved: (val: boolean) => void;
  setCurrentCharacter: (character: StoredCharacter | null) => void;
  updatePlayer: (discordId: string, fields: Partial<WoWPlayer>) => void;
  setSpinState: (groups: WoWGroup[], remainder: WoWGroup[]) => void;
  setCurrentGroupIndex: (index: number) => void;
  setSpinAnimating: (val: boolean) => void;
  setSpinSequenceStarted: (val: boolean) => void;
  setPools: (tanks: WheelEntry[], healers: WheelEntry[], dps: WheelEntry[]) => void;
  addGroupCard: (card: GroupCardData) => void;
  clearGroupCards: () => void;
  setPendingBrowserBack: (val: boolean) => void;
  bumpDungeonSuggestionsRefresh: () => void;
  resetSpinState: () => void;
  resetIdentity: () => void;
  resetSession: () => void;
}

export interface GroupCardData {
  group: WoWGroup;
  index: number;
  label?: string;
  hideEmpty?: boolean;
}
