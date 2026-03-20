import { mockChannelData, mockPlayers, mockGuildData } from '../lib/mockData';
import { useAppStore } from '../store/store';
import type { SessionService } from './types';
import type { ChannelData } from '../types';
import { WoWPlayer, createMythicPlusGroups } from '@mythicplus/shared';

class DemoSessionService implements SessionService {
  subscribeToGuild(_guildId: string): () => void {
    useAppStore.getState().setGuildData(mockGuildData);
    return () => {};
  }

  subscribeToChannel(_channelId: string): () => void {
    return () => {};
  }

  async requestSpin(): Promise<void> {
    const store = useAppStore.getState();
    const currentData = store.channelData;
    if (!currentData) return;

    const sittingOut = currentData.sittingOut ?? [];
    const players = currentData.players
      .filter(p => p.mainRole !== null || p.offspecs.length > 0)
      .filter(p => !p.discordId || !sittingOut.includes(p.discordId))
      .map(p => WoWPlayer.fromDict(p));

    const groups = createMythicPlusGroups(players, true, null);

    // Simulate brief processing delay
    setTimeout(() => {
      useAppStore.getState().setChannelData({
        ...currentData,
        status: 'spinning',
        groups: groups.map(g => g.toDict()),
        revealedGroups: 0,
      } as ChannelData);
    }, 500);
  }

  async revealGroup(_index: number): Promise<void> {
    // Demo mode: animation handled directly, no Firestore needed
  }

  async finishSequence(): Promise<void> {
    const store = useAppStore.getState();
    if (store.channelData) {
      store.setChannelData({ ...store.channelData, status: 'completed' });
    }
  }

  async newRound(): Promise<void> {
    const store = useAppStore.getState();
    if (store.channelData) {
      store.setChannelData({ ...store.channelData, status: 'lobby', groups: [], revealedGroups: 0, sittingOut: [] } as ChannelData);
    }
  }

  async cancelToLobby(): Promise<void> {
    const store = useAppStore.getState();
    if (store.channelData) {
      // Intentionally reset sittingOut on cancel — "sit out this round" applies to the
      // round that was cancelled, so players re-enter the pool for the next attempt.
      store.setChannelData({ ...store.channelData, status: 'lobby', groups: [], revealedGroups: 0, sittingOut: [] } as ChannelData);
    }
  }

  async updateAnnounce(_value: boolean): Promise<void> {
    // No-op in demo
  }

  async saveRoles(_playerId: string, _playerName: string, _roles: string[], _inGameName?: string): Promise<void> {
    // No-op in demo
  }

  async saveLinkedCharacter(): Promise<void> {
    // no-op in demo mode
  }

  async refreshChannels(_guildId: string): Promise<void> {
    // No-op in demo
  }

  async selectChannel(channelId: string, channelName?: string): Promise<void> {
    useAppStore.getState().setChannelData({
      ...mockChannelData,
      channelId,
      channelName: channelName || 'Demo Channel',
      players: mockPlayers,
    });
  }

  async reportBadGroup(_title: string, _description: string): Promise<void> {
    // No-op in demo
  }

  async claimPlayer(playerId: string): Promise<void> {
    const store = useAppStore.getState();
    if (store.channelData) {
      const claimed = store.channelData.claimedPlayers || [];
      if (!claimed.includes(playerId)) {
        store.setChannelData({
          ...store.channelData,
          claimedPlayers: [...claimed, playerId],
        });
      }
    }
  }

  async unclaimPlayer(playerId: string): Promise<void> {
    const store = useAppStore.getState();
    if (store.channelData) {
      const claimed = store.channelData.claimedPlayers || [];
      store.setChannelData({
        ...store.channelData,
        claimedPlayers: claimed.filter(id => id !== playerId),
      });
    }
  }

  async toggleSitOut(discordId: string): Promise<void> {
    const store = useAppStore.getState();
    if (store.channelData) {
      const current = store.channelData.sittingOut ?? [];
      const isSittingOut = current.includes(discordId);
      store.setChannelData({
        ...store.channelData,
        sittingOut: isSittingOut
          ? current.filter(id => id !== discordId)
          : [...current, discordId],
      });
    }
  }

  async createGuildEntry(_guildId: string): Promise<void> {
    // No-op in demo
  }
}

export const demoService = new DemoSessionService();
