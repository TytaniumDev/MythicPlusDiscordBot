import { describe, it, expect } from 'vitest';
import { extractRefreshTargets } from '../src/refreshCharacterMedia';

describe('extractRefreshTargets', () => {
  it('returns targets for docs with a valid linkedCharacter', () => {
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
      },
    ]);
  });

  it('falls back to parsing inGameName when linkedCharacter is missing', () => {
    const docs = [
      { id: 'user-1', data: { inGameName: 'Tytanium-Stormrage' } },
      { id: 'user-2', data: { inGameName: "Kel'thuzad - Area 52" } },
    ];

    expect(extractRefreshTargets(docs)).toEqual([
      { discordId: 'user-1', linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' } },
      { discordId: 'user-2', linkedCharacter: { name: 'Kel\'thuzad', realm: 'area-52', region: 'us' } },
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
      { discordId: 'user-1', linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' } },
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
      { discordId: 'user-1', linkedCharacter: { name: 'Tytanium', realm: 'stormrage', region: 'us' } },
      { discordId: 'user-2', linkedCharacter: { name: 'Firemage', realm: 'uldum', region: 'us' } },
    ]);
  });

  it('skips docs where linkedCharacter fields have wrong types', () => {
    const docs = [
      { id: 'user-1', data: { linkedCharacter: { name: 123, realm: 'stormrage', region: 'us' } } },
    ];

    expect(extractRefreshTargets(docs)).toEqual([]);
  });
});
