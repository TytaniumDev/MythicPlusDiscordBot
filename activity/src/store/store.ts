import { create } from 'zustand';
import { AppState, GroupCardData, ViewName } from './types';
import { WoWGroup, WoWPlayer, WheelEntry, GuildData, ChannelData, SeasonConfig, SeasonPairs } from '../types';
import { saveStoredCharacter, clearStoredCharacter, loadStoredCharacter } from '../lib/currentCharacter';

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentView: 'home',

  // Session
  currentGuildId: null,
  currentChannelId: null,
  guildData: null,
  channelData: null,
  isDemoMode: false,
  discordChannelId: null,
  guildDocCreationInFlight: false,
  seasonConfig: null,
  seasonPairs: null,

  // Status
  statusMessage: '',

  // Identity
  currentPlayerId: null,
  currentPlayerName: null,
  identityResolved: false,
  currentCharacter: loadStoredCharacter(),

  // Spin sequence
  fullGroups: [],
  remainderGroups: [],
  currentGroupIndex: 0,
  isSpinAnimating: false,
  spinSequenceStarted: false,

  // Candidate pools
  poolTanks: [],
  poolHealers: [],
  poolDps: [],

  // Side panel
  groupCards: [],

  // Browser back interception
  pendingBrowserBack: false,

  // Dungeon suggestions refresh trigger
  dungeonSuggestionsRefreshKey: 0,

  // Actions
  setView: (view: ViewName) => set({ currentView: view }),
  setGuildId: (id: string | null) => set({ currentGuildId: id }),
  setChannelId: (id: string | null) => set({ currentChannelId: id }),
  setGuildData: (data: GuildData | null) => set({ guildData: data }),
  setChannelData: (data: ChannelData | null) => set({ channelData: data }),
  setDemoMode: (val: boolean) => set({ isDemoMode: val }),
  setDiscordChannelId: (id: string | null) => set({ discordChannelId: id }),
  setGuildDocCreationInFlight: (val: boolean) => set({ guildDocCreationInFlight: val }),
  setSeasonConfig: (config: SeasonConfig | null) => set({ seasonConfig: config }),
  setSeasonPairs: (pairs: SeasonPairs | null) => set({ seasonPairs: pairs }),
  setStatusMessage: (msg: string) => set({ statusMessage: msg }),
  setIdentity: (id: string | null, name: string | null) =>
    set({ currentPlayerId: id, currentPlayerName: name }),
  setIdentityResolved: (val: boolean) => set({ identityResolved: val }),
  setCurrentCharacter: (character) => {
    if (character) {
      saveStoredCharacter(character);
    } else {
      clearStoredCharacter();
    }
    set({ currentCharacter: character });
  },
  updatePlayer: (discordId: string, fields: Partial<WoWPlayer>) => set((s) => {
    if (!s.channelData) return s;
    const players = s.channelData.players.map((p) =>
      p.discordId === discordId ? { ...p, ...fields } : p,
    );
    return { channelData: { ...s.channelData, players } };
  }),
  setSpinState: (groups: WoWGroup[], remainder: WoWGroup[]) =>
    set({ fullGroups: groups, remainderGroups: remainder }),
  setCurrentGroupIndex: (index: number) => set({ currentGroupIndex: index }),
  setSpinAnimating: (val: boolean) => set({ isSpinAnimating: val }),
  setSpinSequenceStarted: (val: boolean) => set({ spinSequenceStarted: val }),
  setPools: (tanks: WheelEntry[], healers: WheelEntry[], dps: WheelEntry[]) =>
    set({ poolTanks: tanks, poolHealers: healers, poolDps: dps }),
  addGroupCard: (card: GroupCardData) =>
    set((s) => ({ groupCards: [...s.groupCards, card] })),
  clearGroupCards: () => set({ groupCards: [] }),
  setPendingBrowserBack: (val: boolean) => set({ pendingBrowserBack: val }),
  bumpDungeonSuggestionsRefresh: () =>
    set((s) => ({ dungeonSuggestionsRefreshKey: s.dungeonSuggestionsRefreshKey + 1 })),
  resetSpinState: () =>
    set({
      fullGroups: [],
      remainderGroups: [],
      currentGroupIndex: 0,
      isSpinAnimating: false,
      spinSequenceStarted: false,
      poolTanks: [],
      poolHealers: [],
      poolDps: [],
      groupCards: [],
      pendingBrowserBack: false,
    }),
  resetIdentity: () =>
    set({
      currentPlayerId: null,
      currentPlayerName: null,
      identityResolved: false,
    }),
  resetSession: () => {
    get().resetIdentity();
    get().resetSpinState();
    set({
      currentGuildId: null,
      currentChannelId: null,
      guildData: null,
      channelData: null,
      isDemoMode: false,
      discordChannelId: null,
      guildDocCreationInFlight: false,
      seasonConfig: null,
      seasonPairs: null,
      statusMessage: '',
    });
  },
}));
