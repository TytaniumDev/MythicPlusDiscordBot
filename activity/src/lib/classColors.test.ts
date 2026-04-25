import { describe, it, expect } from 'vitest';
import { hexToHsl, hslToHex, relativeLuminance, contrastRatio } from './classColors';

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
