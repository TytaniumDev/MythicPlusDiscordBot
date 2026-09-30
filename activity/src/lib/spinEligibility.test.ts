import { describe, it, expect } from 'vitest';
import type { WoWPlayerDict } from '@mythicplus/shared';
import { eligibleSpinPlayers } from './spinEligibility';

function player(discordId: string, fields: Partial<WoWPlayerDict> = {}): WoWPlayerDict {
  return { name: discordId, discordId, mainRole: 'melee', offspecs: [], utilities: [], ...fields };
}

describe('eligibleSpinPlayers', () => {
  it('keeps players with a main role who are not sitting out', () => {
    const players = [player('1', { mainRole: 'tank' }), player('2', { mainRole: 'healer' }), player('3')];

    expect(eligibleSpinPlayers(players, []).map((p) => p.discordId)).toEqual(['1', '2', '3']);
  });

  it('leaves out players sitting out', () => {
    const players = [player('1'), player('2')];

    expect(eligibleSpinPlayers(players, ['2']).map((p) => p.discordId)).toEqual(['1']);
  });

  it('leaves out players without a main role, even with offspecs', () => {
    // An offspec-only player with a utility is the shape the group algorithm
    // can drop from every group, so none may reach it.
    const players = [
      player('main'),
      player('offspecOnly', { mainRole: null, offspecs: ['healer'], utilities: ['lust'] }),
      player('noRoles', { mainRole: null }),
    ];

    expect(eligibleSpinPlayers(players, []).map((p) => p.discordId)).toEqual(['main']);
  });
});
