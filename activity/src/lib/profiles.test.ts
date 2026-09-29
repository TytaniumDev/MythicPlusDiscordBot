import { describe, it, expect, beforeEach } from 'vitest';
import { isProfileLoading, joinPlayers, needsPortraitRepair, splitPlayers } from './profiles';
import { mockPlayers } from './mockData';
import { useAppStore } from '../store/store';
import type { ChannelData } from '../types';

describe('joinPlayers', () => {
  it('joins each member with their profile, in member order', () => {
    const players = joinPlayers(
      [{ discordId: '2', name: 'Bee' }, { discordId: '1', name: 'Ay' }],
      {
        1: { roles: ['Tank'], inGameName: 'Ay-Illidan', mediaUrl: null, characterClass: 'Warrior' },
        2: { roles: ['Healer', 'Brez'], inGameName: '', mediaUrl: null, characterClass: null },
      },
    );
    expect(players.map((p) => [p.name, p.mainRole, p.utilities])).toEqual([
      ['Bee', 'healer', ['brez']],
      ['Ay', 'tank', []],
    ]);
    expect(players[1].inGameName).toBe('Ay-Illidan');
  });

  it('shows a member without a preferences doc with no roles', () => {
    const [player] = joinPlayers([{ discordId: '3', name: 'New' }], {});
    expect(player).toMatchObject({ name: 'New', discordId: '3', mainRole: null, offspecs: [], utilities: [] });
  });
});

describe('needsPortraitRepair', () => {
  const named = { roles: [], inGameName: 'Ay-Illidan', mediaUrl: null, characterClass: null };

  it('is true for a profile that names a character but has no portrait', () => {
    expect(needsPortraitRepair(named)).toBe(true);
  });

  it('is false with a portrait, without a lookup-ready name, or without a profile', () => {
    expect(needsPortraitRepair({ ...named, mediaUrl: 'https://render.worldofwarcraft.com/a-avatar.jpg' })).toBe(false);
    expect(needsPortraitRepair({ ...named, inGameName: 'Ay' })).toBe(false);
    expect(needsPortraitRepair({ ...named, inGameName: '' })).toBe(false);
    expect(needsPortraitRepair(null)).toBe(false);
    expect(needsPortraitRepair(undefined)).toBe(false);
  });
});

describe('isProfileLoading', () => {
  const players = joinPlayers([{ discordId: '1', name: 'Ay' }], {});

  it('is true for a lobby member whose profile has not arrived', () => {
    expect(isProfileLoading('1', players, {})).toBe(true);
  });

  it('is false once the profile arrived, even when there is no doc', () => {
    expect(isProfileLoading('1', players, { 1: null })).toBe(false);
  });

  it('is false without an identity or outside the lobby', () => {
    expect(isProfileLoading(null, players, {})).toBe(false);
    expect(isProfileLoading('2', players, {})).toBe(false);
  });
});

describe('splitPlayers', () => {
  it('round-trips through joinPlayers', () => {
    const { members, profiles } = splitPlayers(mockPlayers);
    expect(joinPlayers(members, profiles)).toEqual(mockPlayers);
  });
});

describe('store players', () => {
  const lobby: ChannelData = {
    channelId: 'vc-1',
    channelName: 'Lobby',
    guildId: 'g',
    status: 'lobby',
    members: [{ discordId: '1', name: 'Ay' }],
    groups: [],
    isDebug: false,
    createdAt: null,
    lastActive: null,
  };

  beforeEach(() => {
    useAppStore.getState().resetSession();
  });

  it('rejoins when the lobby or the profiles change', () => {
    const store = useAppStore.getState();
    store.setChannelData(lobby);
    expect(useAppStore.getState().players[0].mainRole).toBeNull();

    store.setProfiles({ 1: { roles: ['Ranged'], inGameName: '', mediaUrl: null, characterClass: null } });
    expect(useAppStore.getState().players[0].mainRole).toBe('ranged');

    store.setChannelData({ ...lobby, members: [...lobby.members!, { discordId: '2', name: 'Bee' }] });
    expect(useAppStore.getState().players.map((p) => p.name)).toEqual(['Ay', 'Bee']);
  });

  it('treats a lobby the bot has not filled yet as empty', () => {
    useAppStore.getState().setChannelData({ ...lobby, members: undefined });
    expect(useAppStore.getState().players).toEqual([]);
  });

  it('updateProfile edits one profile for demo mode', () => {
    const store = useAppStore.getState();
    store.setChannelData(lobby);
    store.updateProfile('1', { roles: ['Tank'], inGameName: 'Ay-Illidan' });
    expect(useAppStore.getState().players[0]).toMatchObject({ mainRole: 'tank', inGameName: 'Ay-Illidan' });
  });
});
