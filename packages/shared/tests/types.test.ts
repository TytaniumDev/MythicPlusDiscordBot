import { describe, it, expect } from 'vitest';
import { toRole, toUtility } from '../src/types';

describe('toRole', () => {
  it('returns each known role string verbatim', () => {
    expect(toRole('tank')).toBe('tank');
    expect(toRole('healer')).toBe('healer');
    expect(toRole('ranged')).toBe('ranged');
    expect(toRole('melee')).toBe('melee');
  });

  it('is case-sensitive — capitalized "Tank" is rejected', () => {
    expect(toRole('Tank')).toBeNull();
    expect(toRole('HEALER')).toBeNull();
    expect(toRole('Ranged')).toBeNull();
  });

  it('rejects unknown role strings', () => {
    expect(toRole('dps')).toBeNull();
    expect(toRole('support')).toBeNull();
    expect(toRole('')).toBeNull();
    expect(toRole('tank ')).toBeNull(); // trailing space
  });

  it('returns null for non-string inputs', () => {
    expect(toRole(42)).toBeNull();
    expect(toRole(null)).toBeNull();
    expect(toRole(undefined)).toBeNull();
    expect(toRole({})).toBeNull();
    expect(toRole([])).toBeNull();
    expect(toRole(['tank'])).toBeNull();
    expect(toRole(true)).toBeNull();
    expect(toRole(false)).toBeNull();
  });
});

describe('toUtility', () => {
  it('returns each known utility string verbatim', () => {
    expect(toUtility('brez')).toBe('brez');
    expect(toUtility('lust')).toBe('lust');
  });

  it('is case-sensitive — uppercase "BREZ" is rejected', () => {
    expect(toUtility('BREZ')).toBeNull();
    expect(toUtility('Lust')).toBeNull();
  });

  it('rejects strings with whitespace', () => {
    expect(toUtility('lust ')).toBeNull(); // trailing space
    expect(toUtility(' brez')).toBeNull(); // leading space
  });

  it('rejects unknown utility strings', () => {
    expect(toUtility('heroism')).toBeNull();
    expect(toUtility('')).toBeNull();
  });

  it('returns null for non-string inputs', () => {
    expect(toUtility(7)).toBeNull();
    expect(toUtility(null)).toBeNull();
    expect(toUtility(undefined)).toBeNull();
    expect(toUtility({})).toBeNull();
    expect(toUtility([])).toBeNull();
    expect(toUtility(['brez'])).toBeNull();
    expect(toUtility(true)).toBeNull();
  });
});
