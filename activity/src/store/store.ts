import { create } from 'zustand';
import { AppState, GroupCardData, ViewName } from './types';
import { WoWGroup, WoWPlayer, WheelEntry, GuildData, ChannelData } from '../types';

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

  // Status
  statusMessage: '',

  // Identity
  currentPlayerId: null,
  currentPlayerName: null,
  identityResolved: false,

  // Player modal
  activePlayer: null,

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

  // Actions
  setView: (view: ViewName) => set({ currentView: view }),
  setGuildId: (id: string | null) => set({ currentGuildId: id }),
  setChannelId: (id: string | null) => set({ currentChannelId: id }),
  setGuildData: (data: GuildData | null) => set({ guildData: data }),
  setChannelData: (data: ChannelData | null) => set({ channelData: data }),
  setDemoMode: (val: boolean) => set({ isDemoMode: val }),
  setDiscordChannelId: (id: string | null) => set({ discordChannelId: id }),
  setGuildDocCreationInFlight: (val: boolean) => set({ guildDocCreationInFlight: val }),
  setStatusMessage: (msg: string) => set({ statusMessage: msg }),
  setIdentity: (id: string | null, name: string | null) =>
    set({ currentPlayerId: id, currentPlayerName: name }),
  setIdentityResolved: (val: boolean) => set({ identityResolved: val }),
  setActivePlayer: (player: WoWPlayer | null) => set({ activePlayer: player }),
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
    }),
  resetIdentity: () =>
    set({
      currentPlayerId: null,
      currentPlayerName: null,
      identityResolved: false,
      activePlayer: null,
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
      statusMessage: '',
    });
  },
}));
