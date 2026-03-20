import { describe, it, expect } from 'vitest';
import { getUtilitiesForClass, getRoleForSpec } from '../src/classData';

describe('getUtilitiesForClass', () => {
  it('returns brez for Death Knight', () => { expect(getUtilitiesForClass('Death Knight')).toEqual(['brez']); });
  it('returns brez for Druid', () => { expect(getUtilitiesForClass('Druid')).toEqual(['brez']); });
  it('returns brez for Warlock', () => { expect(getUtilitiesForClass('Warlock')).toEqual(['brez']); });
  it('returns brez for Paladin', () => { expect(getUtilitiesForClass('Paladin')).toEqual(['brez']); });
  it('returns lust for Mage', () => { expect(getUtilitiesForClass('Mage')).toEqual(['lust']); });
  it('returns lust for Shaman', () => { expect(getUtilitiesForClass('Shaman')).toEqual(['lust']); });
  it('returns lust for Evoker', () => { expect(getUtilitiesForClass('Evoker')).toEqual(['lust']); });
  it('returns brez and lust for Hunter', () => { expect(getUtilitiesForClass('Hunter')).toEqual(['brez', 'lust']); });
  it('returns empty for Rogue', () => { expect(getUtilitiesForClass('Rogue')).toEqual([]); });
  it('returns empty for unknown class', () => { expect(getUtilitiesForClass('Unknown')).toEqual([]); });
});

describe('getRoleForSpec', () => {
  it('maps Protection Warrior to tank', () => { expect(getRoleForSpec('Protection', 'Warrior')).toBe('tank'); });
  it('maps Blood to tank (Death Knight)', () => { expect(getRoleForSpec('Blood', 'Death Knight')).toBe('tank'); });
  it('maps Holy Paladin to healer', () => { expect(getRoleForSpec('Holy', 'Paladin')).toBe('healer'); });
  it('maps Restoration Druid to healer', () => { expect(getRoleForSpec('Restoration', 'Druid')).toBe('healer'); });
  it('maps Frost Mage to ranged', () => { expect(getRoleForSpec('Frost', 'Mage')).toBe('ranged'); });
  it('maps Shadow Priest to ranged', () => { expect(getRoleForSpec('Shadow', 'Priest')).toBe('ranged'); });
  it('maps Augmentation Evoker to ranged', () => { expect(getRoleForSpec('Augmentation', 'Evoker')).toBe('ranged'); });
  it('maps Arms Warrior to melee', () => { expect(getRoleForSpec('Arms', 'Warrior')).toBe('melee'); });
  it('maps Survival Hunter to melee', () => { expect(getRoleForSpec('Survival', 'Hunter')).toBe('melee'); });
  it('maps Havoc Demon Hunter to melee', () => { expect(getRoleForSpec('Havoc', 'Demon Hunter')).toBe('melee'); });
  it('maps Frost Death Knight to melee (not ranged)', () => { expect(getRoleForSpec('Frost', 'Death Knight')).toBe('melee'); });
  it('maps Devourer Demon Hunter to ranged', () => { expect(getRoleForSpec('Devourer', 'Demon Hunter')).toBe('ranged'); });
  it('maps Frost Mage to ranged', () => { expect(getRoleForSpec('Frost', 'Mage')).toBe('ranged'); });
  it('defaults unknown spec to melee', () => { expect(getRoleForSpec('Unknown', 'Unknown')).toBe('melee'); });
});
