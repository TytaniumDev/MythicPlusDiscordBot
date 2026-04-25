import type { CharacterClass } from '@mythicplus/shared';

// Blizzard's official WoW class colors, keyed by canonical class name.
const CLASS_COLORS: Record<CharacterClass, string> = {
  'Death Knight': '#C41E3A',
  'Demon Hunter': '#A330C9',
  'Druid': '#FF7C0A',
  'Evoker': '#33937F',
  'Hunter': '#AAD372',
  'Mage': '#3FC7EB',
  'Monk': '#00FF98',
  'Paladin': '#F48CBA',
  'Priest': '#FFFFFF',
  'Rogue': '#FFF468',
  'Shaman': '#0070DD',
  'Warlock': '#8788EE',
  'Warrior': '#C69B6D',
};

export function getClassColor(className: CharacterClass | null | undefined): string | null {
  if (!className) return null;
  return CLASS_COLORS[className] ?? null;
}

interface Hsl {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/** Expects a 6-digit hex string with or without leading '#'. Behavior undefined for other inputs. */
export function hexToHsl(hex: string): Hsl {
  const norm = hex.replace('#', '');
  const r = parseInt(norm.slice(0, 2), 16) / 255;
  const g = parseInt(norm.slice(2, 4), 16) / 255;
  const b = parseInt(norm.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function hslToHex(h: number, s: number, l: number): string {
  const ll = clamp(l, 0, 100) / 100;
  const ss = clamp(s, 0, 100) / 100;
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0, g = 0, b = 0;
  if (hh < 60)        { r = c; g = x; b = 0; }
  else if (hh < 120)  { r = x; g = c; b = 0; }
  else if (hh < 180)  { r = 0; g = c; b = x; }
  else if (hh < 240)  { r = 0; g = x; b = c; }
  else if (hh < 300)  { r = x; g = 0; b = c; }
  else                { r = c; g = 0; b = x; }
  const toByte = (v: number) => {
    const n = Math.round((v + m) * 255);
    return clamp(n, 0, 255).toString(16).padStart(2, '0');
  };
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}
