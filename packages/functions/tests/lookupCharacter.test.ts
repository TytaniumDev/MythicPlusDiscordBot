import { describe, it, expect } from 'vitest';
import { buildCharacterResult, pickMediaUrl } from '../src/lookupCharacter';

const RENDER_BASE = 'https://render.worldofwarcraft.com/us/character/stormrage/31/256146207';

describe('buildCharacterResult', () => {
  it('builds result from Battle.net profile and media data', () => {
    const profile = {
      name: 'Tytanium',
      realm: { slug: 'stormrage', name: 'Stormrage' },
      character_class: { name: 'Warrior' },
      active_specialization: { name: 'Protection' },
      last_login_timestamp: 1790000000000,
    };
    const media = {
      assets: [
        { key: 'inset', value: `${RENDER_BASE}-inset.jpg` },
        { key: 'avatar', value: `${RENDER_BASE}-avatar.jpg` },
      ],
    };

    const result = buildCharacterResult(profile, media);

    expect(result).toEqual({
      name: 'Tytanium',
      realm: 'Stormrage',
      class: 'Warrior',
      role: 'tank',
      utilities: [],
      mediaUrl: `${RENDER_BASE}-avatar.jpg?v=1790000000000`,
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

describe('pickMediaUrl', () => {
  it('prefers avatar over main-raw and inset', () => {
    const media = {
      assets: [
        { key: 'inset', value: `${RENDER_BASE}-inset.jpg` },
        { key: 'main-raw', value: `${RENDER_BASE}-main-raw.png` },
        { key: 'avatar', value: `${RENDER_BASE}-avatar.jpg` },
      ],
    };

    expect(pickMediaUrl(media, undefined)).toBe(`${RENDER_BASE}-avatar.jpg`);
  });

  it('falls back to main-raw, then inset', () => {
    expect(pickMediaUrl({ assets: [{ key: 'main-raw', value: `${RENDER_BASE}-main-raw.png` }] }, undefined))
      .toBe(`${RENDER_BASE}-main-raw.png`);
    expect(pickMediaUrl({ assets: [{ key: 'inset', value: `${RENDER_BASE}-inset.jpg` }] }, undefined))
      .toBe(`${RENDER_BASE}-inset.jpg`);
  });

  it('appends the last-login timestamp as a cache-busting version', () => {
    const media = { assets: [{ key: 'avatar', value: `${RENDER_BASE}-avatar.jpg` }] };

    expect(pickMediaUrl(media, 1790000000000)).toBe(`${RENDER_BASE}-avatar.jpg?v=1790000000000`);
  });

  it('keeps an existing query string when adding the version', () => {
    const media = { assets: [{ key: 'avatar', value: `${RENDER_BASE}-avatar.jpg?alt=x` }] };

    expect(pickMediaUrl(media, 5)).toBe(`${RENDER_BASE}-avatar.jpg?alt=x&v=5`);
  });

  it('returns null when no known asset is present', () => {
    expect(pickMediaUrl({ assets: [{ key: 'main', value: `${RENDER_BASE}-main.jpg` }] }, 5)).toBeNull();
    expect(pickMediaUrl({ assets: [] }, 5)).toBeNull();
    expect(pickMediaUrl({}, 5)).toBeNull();
    expect(pickMediaUrl(null, 5)).toBeNull();
  });
});
