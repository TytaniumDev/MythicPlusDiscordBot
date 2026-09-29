import { describe, it, expect } from 'vitest';
import { WoWPlayer } from '../src/models';
import { parseLobbyMembers, parsePlayerPreferences } from '../src/profiles';

describe('parsePlayerPreferences', () => {
  it('reads every profile field from a full doc', () => {
    expect(parsePlayerPreferences({
      roles: ['Tank', 'Healer Offspec', 'Brez'],
      inGameName: 'Gazzi-Illidan',
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/x.jpg',
      characterClass: 'Paladin',
      wowName: 'legacy',
      updatedAt: { seconds: 1 },
    })).toEqual({
      roles: ['Tank', 'Healer Offspec', 'Brez'],
      inGameName: 'Gazzi-Illidan',
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/x.jpg',
      characterClass: 'Paladin',
    });
  });

  it('defaults every field for a missing or malformed doc', () => {
    const empty = { roles: [], inGameName: '', mediaUrl: null, characterClass: null };
    expect(parsePlayerPreferences(undefined)).toEqual(empty);
    expect(parsePlayerPreferences('nope')).toEqual(empty);
    expect(parsePlayerPreferences({ roles: 'Tank', inGameName: 5, mediaUrl: '', characterClass: 'Bard' }))
      .toEqual(empty);
  });

  it('drops unknown role strings', () => {
    expect(parsePlayerPreferences({ roles: ['Tank', 'DPS', 3, 'Lust'] }).roles).toEqual(['Tank', 'Lust']);
  });
});

describe('parseLobbyMembers', () => {
  it('keeps well-formed members in order', () => {
    expect(parseLobbyMembers([
      { discordId: '2', name: 'Bee' },
      { discordId: '1', name: 'Ay' },
    ])).toEqual([
      { discordId: '2', name: 'Bee' },
      { discordId: '1', name: 'Ay' },
    ]);
  });

  it('drops malformed entries and non-arrays', () => {
    expect(parseLobbyMembers(undefined)).toEqual([]);
    expect(parseLobbyMembers({ discordId: '1', name: 'A' })).toEqual([]);
    expect(parseLobbyMembers([null, { discordId: '', name: 'A' }, { discordId: '1' }, { discordId: '2', name: 'B' }]))
      .toEqual([{ discordId: '2', name: 'B' }]);
  });
});

describe('WoWPlayer.fromPreferences', () => {
  const member = { discordId: '42', name: 'Gazzi' };

  it('joins the member with their preferences', () => {
    const player = WoWPlayer.fromPreferences(member, {
      roles: ['Tank', 'Melee Offspec', 'Brez'],
      inGameName: 'Gazzi-Illidan',
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/x.jpg',
      characterClass: 'Paladin',
    });
    expect(player.toDict()).toEqual({
      name: 'Gazzi',
      discordId: '42',
      inGameName: 'Gazzi-Illidan',
      mainRole: 'tank',
      offspecs: ['melee'],
      utilities: ['brez'],
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/x.jpg',
      characterClass: 'Paladin',
    });
  });

  it('builds a player with no roles when there is no preferences doc', () => {
    const player = WoWPlayer.fromPreferences(member, null);
    expect(player.toDict()).toEqual({
      name: 'Gazzi',
      discordId: '42',
      inGameName: '',
      mainRole: null,
      offspecs: [],
      utilities: [],
    });
    expect(player.hasRoles()).toBe(false);
  });

  it('keeps a portrait even when no roles are picked yet', () => {
    const player = WoWPlayer.fromPreferences(member, {
      roles: [],
      inGameName: 'Gazzi-Illidan',
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/x.jpg',
      characterClass: 'Paladin',
    });
    expect(player.mediaUrl).toBe('https://render.worldofwarcraft.com/us/character/x.jpg');
    expect(player.hasRoles()).toBe(false);
  });
});
