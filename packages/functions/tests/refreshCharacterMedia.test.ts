import { describe, it, expect } from 'vitest';
import { classifyDocs } from '../src/refreshCharacterMedia';

describe('classifyDocs — targets', () => {
  it('returns linkedCharacter-sourced targets for docs with a valid linkedCharacter', () => {
    const { targets, clears } = classifyDocs([
      {
        id: 'user-1',
        data: {
          linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        },
      },
    ]);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'linkedCharacter',
      },
    ]);
    expect(clears).toEqual([]);
  });

  it('falls back to parsing inGameName when linkedCharacter is missing', () => {
    const { targets } = classifyDocs([
      { id: 'user-1', data: { inGameName: 'Tytanium-Stormrage' } },
      { id: 'user-2', data: { inGameName: "Kel'thuzad - Area 52" } },
    ]);

    expect(targets).toEqual([
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

  it('prefers linkedCharacter over inGameName when both are present', () => {
    const { targets } = classifyDocs([
      {
        id: 'user-1',
        data: {
          inGameName: 'Oldname-OtherRealm',
          linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        },
      },
    ]);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'linkedCharacter',
      },
    ]);
  });

  it('falls back to inGameName when linkedCharacter is incomplete', () => {
    const { targets } = classifyDocs([
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
    ]);

    expect(targets).toEqual([
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

  it('falls back to inGameName when linkedCharacter has wrong types', () => {
    const { targets } = classifyDocs([
      {
        id: 'user-1',
        data: {
          inGameName: 'Tytanium-Stormrage',
          linkedCharacter: { name: 123, realm: 'stormrage', region: 'us' },
        },
      },
    ]);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' },
        source: 'inGameName',
      },
    ]);
  });

  it('produces valid slugs even with stray whitespace around hyphens', () => {
    const { targets } = classifyDocs([
      { id: 'user-1', data: { inGameName: 'Char-Azjol - Nerub' } },
    ]);

    expect(targets).toEqual([
      {
        discordId: 'user-1',
        linkedCharacter: { name: 'Char', realm: 'azjol-nerub', region: 'us' },
        source: 'inGameName',
      },
    ]);
  });
});

describe('classifyDocs — clears', () => {
  it('flags docs with inGameName but no realm', () => {
    const { clears } = classifyDocs([
      { id: 'user-1', data: { inGameName: 'Kyle', roles: ['Melee'] } },
      { id: 'user-2', data: { inGameName: 'Tytanium-', roles: ['Tank'] } },
    ]);

    expect(clears).toEqual(['user-1', 'user-2']);
  });

  it('flags docs with stale character fields but no valid identity', () => {
    const { clears } = classifyDocs([
      { id: 'user-1', data: { wowName: 'Legacy-Name', roles: ['Healer'] } },
      { id: 'user-2', data: { mediaUrl: 'https://example/cached.jpg' } },
      // Incomplete linkedCharacter + only legacy wowName → falls through to clear.
      {
        id: 'user-3',
        data: {
          linkedCharacter: { name: 'X', realm: '', region: 'us' },
          wowName: 'OldName',
        },
      },
    ]);

    expect(clears).toEqual(['user-1', 'user-2', 'user-3']);
  });

  it('flags docs with an empty-string inGameName (treated as stale field)', () => {
    // `'' != null` is true, so hasAnyCharacterField picks this up. This is
    // intentional: an empty inGameName is garbage data worth cleaning up.
    const { clears } = classifyDocs([
      { id: 'user-1', data: { inGameName: '', roles: ['Tank'] } },
    ]);

    expect(clears).toEqual(['user-1']);
  });

  it('does not flag docs with a valid linkedCharacter', () => {
    const { clears } = classifyDocs([
      {
        id: 'user-1',
        data: { linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' } },
      },
    ]);

    expect(clears).toEqual([]);
  });

  it('does not flag docs with a parseable inGameName', () => {
    const { clears } = classifyDocs([
      { id: 'user-1', data: { inGameName: 'Tytanium-Stormrage' } },
    ]);

    expect(clears).toEqual([]);
  });

  it('does not flag docs with roles but no character fields', () => {
    const { targets, clears } = classifyDocs([
      { id: 'user-1', data: { roles: ['Tank'] } },
      { id: 'user-2', data: {} },
    ]);

    expect(targets).toEqual([]);
    expect(clears).toEqual([]);
  });
});
