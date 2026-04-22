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

  it('skips docs without linkedCharacter', () => {
    const docs = [
      { id: 'user-1', data: { roles: ['Tank'], inGameName: 'Tytanium-Stormrage' } },
    ];

    expect(extractRefreshTargets(docs)).toEqual([]);
  });

  it('skips docs with incomplete linkedCharacter', () => {
    const docs = [
      { id: 'user-1', data: { linkedCharacter: { name: 'Tytanium', realm: '', region: 'us' } } },
      { id: 'user-2', data: { linkedCharacter: { name: 'Firemage' } } },
      { id: 'user-3', data: { linkedCharacter: null } },
    ];

    expect(extractRefreshTargets(docs)).toEqual([]);
  });

  it('skips docs where linkedCharacter fields have wrong types', () => {
    const docs = [
      { id: 'user-1', data: { linkedCharacter: { name: 123, realm: 'stormrage', region: 'us' } } },
    ];

    expect(extractRefreshTargets(docs)).toEqual([]);
  });
});
