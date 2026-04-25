import { describe, it, expect } from 'vitest';
import { hexToHsl, hslToHex, getSliceColors } from './classColors';

describe('hexToHsl', () => {
  it('parses a known mid-tone color', () => {
    // #C41E3A — Death Knight red
    const { h, s, l } = hexToHsl('#C41E3A');
    expect(h).toBeCloseTo(350, 0);
    expect(s).toBeCloseTo(73, 0);
    expect(l).toBeCloseTo(44, 0);
  });

  it('handles pure white and pure black', () => {
    expect(hexToHsl('#FFFFFF').l).toBeCloseTo(100, 0);
    expect(hexToHsl('#000000').l).toBeCloseTo(0, 0);
  });
});

describe('hslToHex', () => {
  it('round-trips with hexToHsl within 1 unit', () => {
    for (const hex of ['#C41E3A', '#3FC7EB', '#FF7C0A', '#FFF468', '#7a7a8a']) {
      const hsl = hexToHsl(hex);
      const back = hslToHex(hsl.h, hsl.s, hsl.l);
      expect(back).toMatch(/^#[0-9a-f]{6}$/i);
      const want = hex.toLowerCase().replace('#', '');
      const got = back.toLowerCase().replace('#', '');
      for (let i = 0; i < 3; i++) {
        const wantByte = parseInt(want.slice(i * 2, i * 2 + 2), 16);
        const gotByte = parseInt(got.slice(i * 2, i * 2 + 2), 16);
        expect(Math.abs(wantByte - gotByte)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('clamps lightness outside [0,100]', () => {
    expect(hslToHex(0, 0, 150).toLowerCase()).toBe('#ffffff');
    expect(hslToHex(0, 0, -10).toLowerCase()).toBe('#000000');
  });
});

describe('getSliceColors', () => {
  it('is deterministic', () => {
    expect(getSliceColors('Mage', 0)).toBe(getSliceColors('Mage', 0));
  });

  it('produces different fills for different variation indices', () => {
    const fills = [0, 1, 2, 3, 4].map((i) => getSliceColors('Mage', i));
    expect(new Set(fills).size).toBe(5);
  });

  it('falls back to a neutral grey for null class', () => {
    expect(getSliceColors(null, 0).toLowerCase()).toBe('#7a7a8a');
  });

  it('respects the [18, 100] lightness clamp', () => {
    // Priest is white (L=100); positive shifts cap at 100.
    for (const i of [0, 1, 2, 3, 4]) {
      expect(hexToHsl(getSliceColors('Priest', i)).l).toBeLessThanOrEqual(100 + 0.5);
    }
    // Negative shifts on Death Knight (L≈44) stay above the lower bound.
    for (const i of [0, 1, 2, 3, 4]) {
      expect(hexToHsl(getSliceColors('Death Knight', i)).l).toBeGreaterThanOrEqual(18 - 0.5);
    }
  });
});
