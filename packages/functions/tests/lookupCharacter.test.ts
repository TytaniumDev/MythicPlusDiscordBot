import { describe, it, expect } from 'vitest';
import { buildCharacterResult } from '../src/lookupCharacter';

describe('buildCharacterResult', () => {
  it('builds result from Battle.net profile and media data', () => {
    const profile = {
      name: 'Tytanium',
      realm: { slug: 'stormrage', name: 'Stormrage' },
      character_class: { name: 'Warrior' },
      active_specialization: { name: 'Protection' },
    };
    const media = {
      assets: [{ key: 'main-raw', value: 'https://render.worldofwarcraft.com/us/character/main-raw.png' }],
    };

    const result = buildCharacterResult(profile, media);

    expect(result).toEqual({
      name: 'Tytanium',
      realm: 'Stormrage',
      class: 'Warrior',
      role: 'tank',
      utilities: ['brez'],
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/main-raw.png',
    });
  });

  it('returns null mediaUrl when media response is null', () => {
    const profile = {
      name: 'Firemage',
      realm: { slug: 'illidan', name: 'Illidan' },
      character_class: { name: 'Mage' },
      active_specialization: { name: 'Fire' },
    };

    const result = buildCharacterResult(profile, null);

    expect(result.mediaUrl).toBeNull();
    expect(result.role).toBe('ranged');
    expect(result.utilities).toEqual(['lust']);
  });

  it('maps Evoker to lust only (no brez)', () => {
    const profile = {
      name: 'Scaleface',
      realm: { slug: 'area-52', name: 'Area 52' },
      character_class: { name: 'Evoker' },
      active_specialization: { name: 'Devastation' },
    };

    const result = buildCharacterResult(profile, null);

    expect(result.utilities).toEqual(['lust']);
  });
});
