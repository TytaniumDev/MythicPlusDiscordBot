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

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance for a 6-digit hex color (with or without leading '#'). */
export function relativeLuminance(hex: string): number {
  const norm = hex.replace('#', '');
  const r = srgbToLinear(parseInt(norm.slice(0, 2), 16));
  const g = srgbToLinear(parseInt(norm.slice(2, 4), 16));
  const b = srgbToLinear(parseInt(norm.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two 6-digit hex colors. Symmetric; returns 1.0 for identical inputs and 21.0 for white-vs-black. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export interface SliceColors {
  /** Fill color for the slice path (HSL-shifted from the class color). */
  fill: string;
  /** Text fill for the active slice — WCAG-chosen against `fill`. */
  textFill: string;
  /** Text stroke (outline) for the active slice — opposite of textFill. */
  textStroke: string;
  /** Text fill for the chosen state — WCAG-chosen against the grey
   *  equivalent of `fill` (the chosen state applies grayscale(0.95)). */
  chosenTextFill: string;
  /** Text stroke for the chosen state — opposite of chosenTextFill. */
  chosenTextStroke: string;
}

const NULL_CLASS_FALLBACK = '#7a7a8a';

const TEXT_LIGHT = '#ffffff';
const TEXT_DARK = '#000000';
const STROKE_DARK = 'rgba(0, 0, 0, 0.9)';
const STROKE_LIGHT = 'rgba(255, 255, 255, 0.85)';

function lightnessOffsetForIndex(n: number): number {
  // 0 → 0, 1 → -8, 2 → +8, 3 → -16, 4 → +16, …
  const magnitude = ((n + 1) >> 1) * 8;
  return n % 2 === 0 ? magnitude : -magnitude;
}

function pickTextPair(fill: string): { fill: string; stroke: string } {
  const ratioBlack = contrastRatio(fill, TEXT_DARK);
  const ratioWhite = contrastRatio(fill, TEXT_LIGHT);
  if (ratioBlack >= ratioWhite) {
    return { fill: TEXT_DARK, stroke: STROKE_LIGHT };
  }
  return { fill: TEXT_LIGHT, stroke: STROKE_DARK };
}

function cssGrayscaleEquivalent(hex: string): string {
  const norm = hex.replace('#', '');
  const r = parseInt(norm.slice(0, 2), 16);
  const g = parseInt(norm.slice(2, 4), 16);
  const b = parseInt(norm.slice(4, 6), 16);
  const grey = Math.round(clamp(0.2126 * r + 0.7152 * g + 0.0722 * b, 0, 255));
  const byteHex = grey.toString(16).padStart(2, '0');
  return `#${byteHex}${byteHex}${byteHex}`;
}

export function getSliceColors(
  className: CharacterClass | null | undefined,
  variationIndex: number,
): SliceColors {
  const baseHex = className ? CLASS_COLORS[className] : NULL_CLASS_FALLBACK;
  const { h, s, l } = hexToHsl(baseHex);
  const shifted = clamp(l + lightnessOffsetForIndex(variationIndex), 18, 85);
  const fill = hslToHex(h, s, shifted);

  const active = pickTextPair(fill);

  // For the chosen state, the slice has CSS `filter: grayscale(0.95)`. CSS
  // `grayscale()` is a BT.709-weighted sum applied directly to sRGB bytes
  // (no linearization). Modelling it as grayscale(1.0) here is a tight
  // approximation — the 5% color residue is too small to flip the
  // black-vs-white text choice.
  const chosen = pickTextPair(cssGrayscaleEquivalent(fill));

  return {
    fill,
    textFill: active.fill,
    textStroke: active.stroke,
    chosenTextFill: chosen.fill,
    chosenTextStroke: chosen.stroke,
  };
}
