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

    const players = currentData.players
      .filter(p => p.mainRole !== null || p.offspecs.length > 0)
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
      store.setChannelData({ ...store.channelData, status: 'lobby', groups: [], revealedGroups: 0 } as ChannelData);
    }
  }

  async cancelToLobby(): Promise<void> {
    const store = useAppStore.getState();
    if (store.channelData) {
      store.setChannelData({ ...store.channelData, status: 'lobby', groups: [], revealedGroups: 0 } as ChannelData);
    }
  }

  async updateAnnounce(_value: boolean): Promise<void> {
    // No-op in demo
  }

  async saveRoles(_playerId: string, _playerName: string, _roles: string[]): Promise<void> {
    // No-op in demo
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

  async createGuildEntry(_guildId: string): Promise<void> {
    // No-op in demo
  }
}

export const demoService = new DemoSessionService();
