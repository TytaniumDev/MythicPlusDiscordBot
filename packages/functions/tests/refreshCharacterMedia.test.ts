import { describe, it, expect } from 'vitest';
import { extractRefreshTargets, extractClearTargets } from '../src/refreshCharacterMedia';

describe('extractRefreshTargets', () => {
  it('returns linkedCharacter-sourced targets for docs with a valid linkedCharacter', () => {
    const docs = [
      {
        id: 'user-1',
        data: {
          linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        },
      },
    ];

    const targets = extractRefreshTargets(docs);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'linkedCharacter',
      },
    ]);
  });

  it('falls back to parsing inGameName when linkedCharacter is missing', () => {
    const docs = [
      { id: 'user-1', data: { inGameName: 'Tytanium-Stormrage' } },
      { id: 'user-2', data: { inGameName: "Kel'thuzad - Area 52" } },
    ];

    expect(extractRefreshTargets(docs)).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'inGameName',
      },
      {
        discordId: 'user-2',
        linkedCharacter: { name: "Kel'thuzad", realm: 'area-52', region: 'us' },
        source: 'inGameName',
      },
    ]);
  });

  it('skips docs with an inGameName that has no realm', () => {
    const docs = [
      { id: 'user-1', data: { inGameName: 'Kyle' } },
      { id: 'user-2', data: { inGameName: 'Tytanium-' } },
      { id: 'user-3', data: { inGameName: '' } },
      { id: 'user-4', data: {} },
    ];

    expect(extractRefreshTargets(docs)).toEqual([]);
  });

  it('prefers linkedCharacter over inGameName when both are present', () => {
    const docs = [
      {
        id: 'user-1',
        data: {
          inGameName: 'Oldname-OtherRealm',
          linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        },
      },
    ];

    expect(extractRefreshTargets(docs)).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'linkedCharacter',
      },
    ]);
  });

  it('falls back to inGameName when linkedCharacter is incomplete', () => {
    const docs = [
      {
        id: 'user-1',
        data: {
          inGameName: 'Tytanium-Stormrage',
          linkedCharacter: { name: 'Tytanium', realm: '', region: 'us' },
        },
      },
      {
        id: 'user-2',
        data: {
          inGameName: 'Firemage-Uldum',
          linkedCharacter: null,
        },
      },
    ];

    expect(extractRefreshTargets(docs)).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'inGameName',
      },
      {
        discordId: 'user-2',
        linkedCharacter: { name: 'Firemage', realm: 'uldum', region: 'us' },
        source: 'inGameName',
      },
    ]);
  });

  it('skips docs where linkedCharacter fields have wrong types', () => {
    const docs = [
      { id: 'user-1', data: { linkedCharacter: { name: 123, realm: 'stormrage', region: 'us' } } },
    ];

    expect(extractRefreshTargets(docs)).toEqual([]);
  });

  it('falls back to inGameName when linkedCharacter has wrong types', () => {
    const docs = [
      {
        id: 'user-1',
        data: {
          inGameName: 'Tytanium-Stormrage',
          linkedCharacter: { name: 123, realm: 'stormrage', region: 'us' },
        },
      },
    ];

    expect(extractRefreshTargets(docs)).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'inGameName',
      },
    ]);
  });

  it('produces valid slugs even with stray whitespace around hyphens', () => {
    const docs = [
      { id: 'user-1', data: { inGameName: 'Char-Azjol - Nerub' } },
    ];

    expect(extractRefreshTargets(docs)).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Char', realm: 'azjol-nerub', region: 'us' },
        source: 'inGameName',
      },
    ]);
  });
});

describe('extractClearTargets', () => {
  it('flags docs with inGameName but no realm', () => {
    const docs = [
      { id: 'user-1', data: { inGameName: 'Kyle', roles: ['Melee'] } },
      { id: 'user-2', data: { inGameName: 'Tytanium-', roles: ['Tank'] } },
    ];

    expect(extractClearTargets(docs)).toEqual(['user-1', 'user-2']);
  });

  it('flags docs with stale character fields but no valid identity', () => {
    const docs = [
      { id: 'user-1', data: { wowName: 'Legacy-Name', roles: ['Healer'] } },
      { id: 'user-2', data: { mediaUrl: 'https://example/cached.jpg' } },
    ];

    expect(extractClearTargets(docs)).toEqual(['user-1', 'user-2']);
  });

  it('does not flag docs with a valid linkedCharacter', () => {
    const docs = [
      {
        id: 'user-1',
        data: { linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' } },
      },
    ];

    expect(extractClearTargets(docs)).toEqual([]);
  });

  it('does not flag docs with a parseable inGameName', () => {
    const docs = [
      { id: 'user-1', data: { inGameName: 'Tytanium-Stormrage' } },
    ];

    expect(extractClearTargets(docs)).toEqual([]);
  });

  it('does not flag docs with roles but no character fields', () => {
    const docs = [
      { id: 'user-1', data: { roles: ['Tank'] } },
      { id: 'user-2', data: {} },
    ];

    expect(extractClearTargets(docs)).toEqual([]);
  });
});
