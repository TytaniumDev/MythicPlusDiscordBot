import { describe, it, expect } from 'vitest';
import { computeToggledRoles } from './roles';

describe('computeToggledRoles', () => {
  describe('main spec swap', () => {
    it('swaps main and offspec when new main was an offspec', () => {
      // Main=Tank, Offspec=Healer. Select main Healer → Main=Healer, Offspec=Tank
      const prev = new Set(['Tank', 'Healer Offspec']);
      const result = computeToggledRoles(prev, 'Healer', true);

      expect(result.has('Healer')).toBe(true);
      expect(result.has('Tank Offspec')).toBe(true);
      expect(result.has('Tank')).toBe(false);
      expect(result.has('Healer Offspec')).toBe(false);
    });

    it('does not change offspecs when new main was not an offspec', () => {
      // Main=Healer, no offspec. Select DPS main → Main=Ranged, no offspec change
      const prev = new Set(['Healer']);
      const result = computeToggledRoles(prev, 'Ranged', true);

      expect(result.has('Ranged')).toBe(true);
      expect(result.has('Healer')).toBe(false);
      expect(result.size).toBe(1);
    });

    it('preserves unrelated offspecs and utilities during swap', () => {
      // Main=Tank, Offspec=Healer+Melee, Utility=Brez. Select main Healer.
      const prev = new Set(['Tank', 'Healer Offspec', 'Melee Offspec', 'Brez']);
      const result = computeToggledRoles(prev, 'Healer', true);

      expect(result.has('Healer')).toBe(true);
      expect(result.has('Tank Offspec')).toBe(true);
      expect(result.has('Melee Offspec')).toBe(true);
      expect(result.has('Brez')).toBe(true);
      expect(result.has('Tank')).toBe(false);
      expect(result.has('Healer Offspec')).toBe(false);
    });

    it('handles switching main with no previous main', () => {
      // No main, Offspec=Healer. Select main Healer → Main=Healer, offspec removed (no swap since no old main)
      const prev = new Set(['Healer Offspec']);
      const result = computeToggledRoles(prev, 'Healer', true);

      expect(result.has('Healer')).toBe(true);
      expect(result.has('Healer Offspec')).toBe(false);
      expect(result.size).toBe(1);
    });
  });

  describe('offspec toggle', () => {
    it('blocks adding offspec that matches current main', () => {
      // Main=Tank. Try to add Tank Offspec → no-op
      const prev = new Set(['Tank']);
      const result = computeToggledRoles(prev, 'Tank Offspec', false);

      expect(result).toEqual(prev);
      expect(result.has('Tank Offspec')).toBe(false);
    });

    it('allows adding offspec that differs from main', () => {
      // Main=Tank. Add Healer Offspec → allowed
      const prev = new Set(['Tank']);
      const result = computeToggledRoles(prev, 'Healer Offspec', false);

      expect(result.has('Tank')).toBe(true);
      expect(result.has('Healer Offspec')).toBe(true);
    });

    it('removes offspec on second click', () => {
      // Main=Healer, Offspec=Tank. Click Tank Offspec → removes it
      const prev = new Set(['Healer', 'Tank Offspec']);
      const result = computeToggledRoles(prev, 'Tank Offspec', false);

      expect(result.has('Healer')).toBe(true);
      expect(result.has('Tank Offspec')).toBe(false);
    });
  });

  describe('removing roles', () => {
    it('removes main spec on toggle', () => {
      const prev = new Set(['Tank', 'Brez']);
      const result = computeToggledRoles(prev, 'Tank', true);

      expect(result.has('Tank')).toBe(false);
      expect(result.has('Brez')).toBe(true);
    });

    it('removes utility on toggle', () => {
      const prev = new Set(['Tank', 'Brez', 'Lust']);
      const result = computeToggledRoles(prev, 'Brez', false);

      expect(result.has('Brez')).toBe(false);
      expect(result.has('Tank')).toBe(true);
      expect(result.has('Lust')).toBe(true);
    });
  });
});

import { initPools } from './roles';

describe('initPools portrait fields', () => {
  it('carries mediaUrl and characterClass through to WheelEntry', () => {
    const players = [
      {
        name: 'Tank1',
        discordId: '1',
        mainRole: 'tank',
        offspecs: [],
        utilities: [],
        mediaUrl: 'https://example.com/abc-inset.jpg',
        characterClass: 'warrior',
      },
      {
        name: 'Healer1',
        discordId: '2',
        mainRole: 'healer',
        offspecs: [],
        utilities: [],
        mediaUrl: null,
        characterClass: null,
      },
    ] as const;

    const pools = initPools(players as never);
    expect(pools.tanks[0]).toMatchObject({
      name: 'Tank1',
      mediaUrl: 'https://example.com/abc-inset.jpg',
      characterClass: 'warrior',
    });
    expect(pools.healers[0]).toMatchObject({
      name: 'Healer1',
      mediaUrl: null,
      characterClass: null,
    });
  });
});
