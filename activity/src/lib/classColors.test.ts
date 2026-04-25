import { describe, it, expect } from 'vitest';
import { CHARACTER_CLASSES } from '@mythicplus/shared';
import {
  hexToHsl,
  hslToHex,
  relativeLuminance,
  contrastRatio,
  getSliceColors,
} from './classColors';

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

describe('relativeLuminance', () => {
  it('returns 1 for white and 0 for black', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 4);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 4);
  });

  it('returns ~0.2126 for pure red', () => {
    // sRGB→Y coefficient for red
    expect(relativeLuminance('#FF0000')).toBeCloseTo(0.2126, 3);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for white-vs-black', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#3FC7EB', '#000000'))
      .toBeCloseTo(contrastRatio('#000000', '#3FC7EB'), 6);
  });

  it('returns 1 for identical colors', () => {
    expect(contrastRatio('#888888', '#888888')).toBeCloseTo(1, 6);
  });
});

describe('getSliceColors', () => {
  it('is deterministic', () => {
    const a = getSliceColors('Mage', 0);
    const b = getSliceColors('Mage', 0);
    expect(a).toEqual(b);
  });

  it('produces different fills for different variation indices', () => {
    const fills = [0, 1, 2, 3, 4].map((i) => getSliceColors('Mage', i).fill);
    const unique = new Set(fills);
    expect(unique.size).toBe(5);
  });

  it('falls back to a neutral grey for null class', () => {
    const { fill } = getSliceColors(null, 0);
    expect(fill.toLowerCase()).toBe('#7a7a8a');
  });

  it('clamps lightness to [18, 85]', () => {
    // Priest is white (L=100). With a clamp at 85, no variation may exceed L=85.
    for (const i of [0, 1, 2, 3, 4]) {
      const { fill } = getSliceColors('Priest', i);
      expect(hexToHsl(fill).l).toBeLessThanOrEqual(85 + 0.5);
    }
    // Conversely a negative-shift on Death Knight (L≈44) shouldn't drop below 18.
    for (const i of [0, 1, 2, 3, 4]) {
      const { fill } = getSliceColors('Death Knight', i);
      expect(hexToHsl(fill).l).toBeGreaterThanOrEqual(18 - 0.5);
    }
  });

  it('every (class, variationIndex) pair has >= 4.5:1 contrast on active state', () => {
    const failures: string[] = [];
    for (const cls of [...CHARACTER_CLASSES, null] as const) {
      for (const i of [0, 1, 2, 3, 4]) {
        const { fill, textFill } = getSliceColors(cls, i);
        const ratio = contrastRatio(fill, textFill);
        if (ratio < 4.5) {
          failures.push(`${cls ?? 'null'} idx=${i}: ${ratio.toFixed(2)}:1 (fill=${fill}, text=${textFill})`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('every (class, variationIndex) pair has >= 4.5:1 contrast on chosen state', () => {
    const failures: string[] = [];
    for (const cls of [...CHARACTER_CLASSES, null] as const) {
      for (const i of [0, 1, 2, 3, 4]) {
        const { fill, chosenTextFill } = getSliceColors(cls, i);
        // CSS `grayscale(0.95)` ≈ BT.709-weighted sum on sRGB bytes. Compute
        // independently from the implementation so this test isn't circular.
        const norm = fill.replace('#', '');
        const r = parseInt(norm.slice(0, 2), 16);
        const g = parseInt(norm.slice(2, 4), 16);
        const b = parseInt(norm.slice(4, 6), 16);
        const greyByte = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
        const clamped = Math.min(255, Math.max(0, greyByte));
        const greyHex = '#' + clamped.toString(16).padStart(2, '0').repeat(3);
        const ratio = contrastRatio(greyHex, chosenTextFill);
        if (ratio < 4.5) {
          failures.push(`${cls ?? 'null'} idx=${i}: ${ratio.toFixed(2)}:1 (grey=${greyHex}, text=${chosenTextFill})`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
