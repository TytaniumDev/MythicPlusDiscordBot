import { mockChannelData, mockPlayers, mockGuildData } from '../lib/mockData';
import { useAppStore } from '../store/store';
import type { SessionService } from './types';
import type { ChannelData } from '../types';
import { WoWPlayer, createMythicPlusGroups } from '@mythicplus/shared';
import type { CharacterClass } from '@mythicplus/shared';

/**
 * Apply a partial update to the in-memory channelData. No-op when there is
 * no active channel — mirrors the early-return pattern the Firestore service
 * uses around currentChannelId, but for the demo's local-only state.
 */
function patchChannelData(patch: Partial<ChannelData> | ((data: ChannelData) => Partial<ChannelData>)): void {
  const store = useAppStore.getState();
  const data = store.channelData;
  if (!data) return;
  const update = typeof patch === 'function' ? patch(data) : patch;
  store.setChannelData({ ...data, ...update });
}

class DemoSessionService implements SessionService {
  subscribeToGuild(_guildId: string): () => void {
    useAppStore.getState().setGuildData(mockGuildData);
    return () => {};
  }

  subscribeToChannel(_channelId: string): () => void {
    return () => {};
  }

  async requestSpin(): Promise<void> {
    const currentData = useAppStore.getState().channelData;
    if (!currentData) return;

    const sittingOut = currentData.sittingOut ?? [];
    const players = currentData.players
      .filter((p) => (p.mainRole !== null || p.offspecs.length > 0)
        && (!p.discordId || !sittingOut.includes(p.discordId)))
      .map((p) => WoWPlayer.fromDict(p));

    const groupDicts = createMythicPlusGroups(players, true, null).map((g) => g.toDict());

    // Simulated processing delay — preserves the demo's "computing..." beat.
    setTimeout(() => {
      patchChannelData({ status: 'spinning', groups: groupDicts, revealedGroups: 0 });
    }, 500);
  }

  async revealAllGroups(): Promise<void> {
    // Demo mode: animation handled directly by WheelsView auto-advance loop
  }

  async finishSequence(): Promise<void> {
    patchChannelData({ status: 'completed' });
  }

  async newRound(): Promise<void> {
    patchChannelData({ status: 'lobby', groups: [], revealedGroups: 0, sittingOut: [] });
  }

  async cancelToLobby(): Promise<void> {
    // Intentionally reset sittingOut on cancel — "sit out this round" applies to the
    // round that was cancelled, so players re-enter the pool for the next attempt.
    patchChannelData({ status: 'lobby', groups: [], revealedGroups: 0, sittingOut: [] });
  }

  async saveRoles(playerId: string, _playerName: string, _roles: string[], inGameName?: string): Promise<void> {
    if (inGameName !== undefined) {
      useAppStore.getState().updatePlayer(playerId, { inGameName });
    }
  }

  async saveLinkedCharacter(
    playerId: string,
    _linkedCharacter: { name: string; realm: string; region: string },
    mediaUrl?: string | null,
    characterClass?: CharacterClass | null,
  ): Promise<void> {
    const patch: Partial<{ mediaUrl: string | null; characterClass: CharacterClass | null }> = {};
    if (mediaUrl !== undefined) patch.mediaUrl = mediaUrl;
    if (characterClass !== undefined) patch.characterClass = characterClass;
    if (Object.keys(patch).length > 0) {
      useAppStore.getState().updatePlayer(playerId, patch);
    }
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
    patchChannelData((data) => {
      const claimed = data.claimedPlayers || [];
      return claimed.includes(playerId) ? {} : { claimedPlayers: [...claimed, playerId] };
    });
  }

  async unclaimPlayer(playerId: string): Promise<void> {
    patchChannelData((data) => ({
      claimedPlayers: (data.claimedPlayers || []).filter((id) => id !== playerId),
    }));
  }

  async toggleSitOut(discordId: string): Promise<void> {
    patchChannelData((data) => {
      const current = data.sittingOut ?? [];
      return {
        sittingOut: current.includes(discordId)
          ? current.filter((id) => id !== discordId)
          : [...current, discordId],
      };
    });
  }

  async createGuildEntry(_guildId: string): Promise<void> {
    // No-op in demo
  }
}

export const demoService = new DemoSessionService();
