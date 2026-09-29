import { mockChannelData, mockProfiles, mockGuildData } from '../lib/mockData';
import { useAppStore } from '../store/store';
import type { BadGroupReportInput, SessionService } from './types';
import type { ChannelData, WoWPlayer } from '../types';
import { createMythicPlusGroups, parsePlayerPreferences } from '@mythicplus/shared';
import type { CharacterClass, PlayerPreferences } from '@mythicplus/shared';
import { eligibleSpinPlayers } from '../lib/spinEligibility';
import { lobbyReset } from './lobby';

/**
 * Apply a partial update to the in-memory channelData. The demo has a single
 * lobby, so the channel ID the callers pass is not needed to find it.
 */
function patchChannelData(patch: Partial<ChannelData> | ((data: ChannelData) => Partial<ChannelData>)): void {
  const store = useAppStore.getState();
  const data = store.channelData;
  if (!data) return;
  const update = typeof patch === 'function' ? patch(data) : patch;
  store.setChannelData({ ...data, ...update });
}

class DemoSessionService implements SessionService {
  subscribeToGuild(_guildId: string, _launchChannelId: string | null): () => void {
    useAppStore.getState().setGuildData(mockGuildData);
    return () => {};
  }

  subscribeToChannel(_channelId: string): () => void {
    return () => {};
  }

  async requestSpin(_channelId: string, lobbyPlayers: readonly WoWPlayer[], _seasonSlug: string | null): Promise<void> {
    const currentData = useAppStore.getState().channelData;
    if (!currentData) return;

    const players = eligibleSpinPlayers(lobbyPlayers, currentData.sittingOut ?? []);

    const groupDicts = createMythicPlusGroups(players, true, null).map((g) => g.toDict());

    // Simulated processing delay — preserves the demo's "computing..." beat.
    setTimeout(() => {
      patchChannelData({ status: 'spinning', groups: groupDicts, revealedGroups: 0 });
    }, 500);
  }

  async revealAllGroups(_channelId: string, _groupCount: number): Promise<void> {
    // Demo mode: animation handled directly by WheelsView auto-advance loop
  }

  async finishSequence(_channelId: string): Promise<void> {
    patchChannelData({ status: 'completed' });
  }

  async newRound(_channelId: string): Promise<void> {
    patchChannelData(lobbyReset());
  }

  async cancelToLobby(_channelId: string): Promise<void> {
    patchChannelData(lobbyReset());
  }

  async saveRoles(playerId: string, roles: string[], inGameName: string): Promise<void> {
    const { roles: validRoles } = parsePlayerPreferences({ roles });
    useAppStore.getState().updateProfile(playerId, { roles: validRoles, inGameName });
  }

  async saveLinkedCharacter(
    playerId: string,
    _linkedCharacter: { name: string; realm: string; region: string },
    mediaUrl?: string | null,
    characterClass?: CharacterClass | null,
  ): Promise<void> {
    const patch: Partial<PlayerPreferences> = {};
    if (mediaUrl !== undefined) patch.mediaUrl = mediaUrl;
    if (characterClass !== undefined) patch.characterClass = characterClass;
    useAppStore.getState().updateProfile(playerId, patch);
  }

  async refreshChannels(_guildId: string): Promise<void> {
    // No-op in demo
  }

  async selectChannel(channelId: string, channelName?: string): Promise<void> {
    const store = useAppStore.getState();
    store.setProfiles(mockProfiles);
    store.setChannelData({
      ...mockChannelData,
      channelId,
      channelName: channelName || 'Demo Channel',
    });
  }

  async reportBadGroup(_report: BadGroupReportInput): Promise<void> {
    // No-op in demo
  }

  async claimPlayer(_channelId: string, playerId: string): Promise<void> {
    patchChannelData((data) => {
      const claimed = data.claimedPlayers || [];
      return claimed.includes(playerId) ? {} : { claimedPlayers: [...claimed, playerId] };
    });
  }

  async unclaimPlayer(_channelId: string, playerId: string): Promise<void> {
    patchChannelData((data) => ({
      claimedPlayers: (data.claimedPlayers || []).filter((id) => id !== playerId),
    }));
  }

  async setSittingOut(_channelId: string, discordId: string, sittingOut: boolean): Promise<void> {
    patchChannelData((data) => {
      const current = data.sittingOut ?? [];
      if (current.includes(discordId) === sittingOut) return {};
      return { sittingOut: sittingOut ? [...current, discordId] : current.filter((id) => id !== discordId) };
    });
  }
}

export const demoService = new DemoSessionService();
