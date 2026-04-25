# Class-Colored Wheel Slices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wheel's hard-coded 12-color slice palette with WoW class colors, with per-class shade variation so duplicate classes look related-but-distinct, and dynamic black/white text per slice so labels stay legible (≥ 4.5:1 contrast on every fill).

**Architecture:** All color math lives in `activity/src/lib/classColors.ts`. A new `getSliceColors(className, variationIndex)` function returns the slice fill (HSL-shifted from the official Blizzard color), the WCAG-correct text fill/stroke pair for the active state, and a separate text fill/stroke pair for the chosen (greyscale-filtered) state. `Wheel.tsx` computes per-class variation indices via `useMemo` over the current `entries` array (stable for the duration of a round) and threads colors into the SVG via CSS custom properties so existing state-based CSS rules can keep overriding cleanly.

**Tech Stack:** TypeScript, React, SVG, vitest (unit), Playwright (snapshot), Vite, CSS custom properties.

**Spec:** [`docs/superpowers/specs/2026-04-24-class-colored-wheel-slices-design.md`](../specs/2026-04-24-class-colored-wheel-slices-design.md)

---

## How to run tests

- **Unit tests** (this plan adds these): from the `activity/` directory, `npx vitest --project unit run` — runs all `*.test.ts` files in node environment.
- **Single test file:** `npx vitest --project unit run src/lib/classColors.test.ts`
- **Typecheck:** `cd activity && npm run typecheck`
- **Build:** `cd activity && npm run build`
- **Storybook build:** `cd activity && npm run build-storybook`
- **Playwright snapshots (Docker, from project root):** `./scripts/playwright-docker.sh` — verify, `./scripts/playwright-docker.sh --update-snapshots` — regen.

---

## Task 1: Add HSL conversion helpers

**Files:**
- Modify: `activity/src/lib/classColors.ts` (currently 24 lines, exports `getClassColor`)
- Create: `activity/src/lib/classColors.test.ts`

The wheel's class palette is given in 6-digit hex. To shift lightness while preserving hue and saturation we need round-trippable hex↔HSL conversion. Internal helpers — not exported.

- [ ] **Step 1: Write the failing test**

Append to (new file) `activity/src/lib/classColors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { __test } from './classColors';

const { hexToHsl, hslToHex } = __test;

describe('hexToHsl', () => {
  it('parses a known mid-tone color', () => {
    // #C41E3A — Death Knight red
    const { h, s, l } = hexToHsl('#C41E3A');
    expect(h).toBeCloseTo(350, 0);
    expect(s).toBeCloseTo(74, 0);
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
      // Compare normalized lowercase hex with ±1 R/G/B tolerance.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run from `activity/`:
```
npx vitest --project unit run src/lib/classColors.test.ts
```
Expected: FAIL with `__test is undefined` (or "has no exported member").

- [ ] **Step 3: Add helpers and `__test` export to `classColors.ts`**

Replace the file contents with:

```ts
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

function hexToHsl(hex: string): Hsl {
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

function hslToHex(h: number, s: number, l: number): string {
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

// Test-only export. Do not import this from production code.
export const __test = { hexToHsl, hslToHex };
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `activity/`:
```
npx vitest --project unit run src/lib/classColors.test.ts
```
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add activity/src/lib/classColors.ts activity/src/lib/classColors.test.ts
git commit -m "feat(activity): add HSL conversion helpers in classColors"
```

---

## Task 2: Add WCAG luminance + contrast helpers

**Files:**
- Modify: `activity/src/lib/classColors.ts`
- Modify: `activity/src/lib/classColors.test.ts`

For dynamic text color we need WCAG relative luminance and contrast ratio. Internal helpers — exposed via the `__test` namespace.

- [ ] **Step 1: Write the failing tests**

Append to `activity/src/lib/classColors.test.ts`:

```ts
describe('relativeLuminance', () => {
  const { relativeLuminance } = __test;

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
  const { contrastRatio } = __test;

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
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest --project unit run src/lib/classColors.test.ts
```
Expected: 3 new tests fail with `relativeLuminance is undefined` / `contrastRatio is undefined`.

- [ ] **Step 3: Add helpers**

In `activity/src/lib/classColors.ts`, before the `__test` export at the end, add:

```ts
function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const norm = hex.replace('#', '');
  const r = srgbToLinear(parseInt(norm.slice(0, 2), 16));
  const g = srgbToLinear(parseInt(norm.slice(2, 4), 16));
  const b = srgbToLinear(parseInt(norm.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}
```

And update the `__test` export at the bottom of the file:

```ts
export const __test = { hexToHsl, hslToHex, relativeLuminance, contrastRatio };
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest --project unit run src/lib/classColors.test.ts
```
Expected: 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add activity/src/lib/classColors.ts activity/src/lib/classColors.test.ts
git commit -m "feat(activity): add WCAG luminance + contrast helpers"
```

---

## Task 3: Implement `getSliceColors`

**Files:**
- Modify: `activity/src/lib/classColors.ts`
- Modify: `activity/src/lib/classColors.test.ts`

The public function the wheel will call. Returns five fields:
- `fill` — shaded class color (HSL-shifted)
- `textFill` / `textStroke` — chosen by WCAG contrast vs `fill`
- `chosenTextFill` / `chosenTextStroke` — chosen by WCAG contrast vs the *grayscale-equivalent* of `fill` (the chosen-state CSS filter is `grayscale(0.95)`, which maps fill → its relative luminance as a grey)

Lightness clamp: `[18, 85]`. Variation series for index `n`: offset = `((n + 1) >> 1) * 8` with sign `n` even → +, odd → −.

- [ ] **Step 1: Write the failing tests**

Append to `activity/src/lib/classColors.test.ts`:

```ts
import { CHARACTER_CLASSES } from '@mythicplus/shared';
import { getSliceColors } from './classColors';

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
      expect(__test.hexToHsl(fill).l).toBeLessThanOrEqual(85 + 0.5);
    }
    // Conversely a negative-shift on Death Knight (L≈44) shouldn't drop below 18.
    for (const i of [0, 1, 2, 3, 4]) {
      const { fill } = getSliceColors('Death Knight', i);
      expect(__test.hexToHsl(fill).l).toBeGreaterThanOrEqual(18 - 0.5);
    }
  });

  it('every (class, variationIndex) pair has ≥ 4.5:1 contrast on active state', () => {
    const failures: string[] = [];
    for (const cls of [...CHARACTER_CLASSES, null] as const) {
      for (const i of [0, 1, 2, 3, 4]) {
        const { fill, textFill } = getSliceColors(cls, i);
        const ratio = __test.contrastRatio(fill, textFill);
        if (ratio < 4.5) {
          failures.push(`${cls ?? 'null'} idx=${i}: ${ratio.toFixed(2)}:1 (fill=${fill}, text=${textFill})`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('every (class, variationIndex) pair has ≥ 4.5:1 contrast on chosen state', () => {
    const failures: string[] = [];
    for (const cls of [...CHARACTER_CLASSES, null] as const) {
      for (const i of [0, 1, 2, 3, 4]) {
        const { fill, chosenTextFill } = getSliceColors(cls, i);
        // The chosen-state filter is grayscale(0.95). The grey it yields has
        // lightness ≈ relativeLuminance(fill). Convert to an equivalent hex
        // and measure contrast against chosenTextFill.
        const lum = __test.relativeLuminance(fill);
        const greyByte = Math.round(Math.pow(lum, 1 / 2.4) * 255); // approx sRGB inverse
        const greyHex =
          '#' +
          greyByte.toString(16).padStart(2, '0').repeat(3);
        const ratio = __test.contrastRatio(greyHex, chosenTextFill);
        if (ratio < 4.5) {
          failures.push(`${cls ?? 'null'} idx=${i}: ${ratio.toFixed(2)}:1 (grey=${greyHex}, text=${chosenTextFill})`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
```

(The tests reach `__test` via the top-of-file destructure added in Task 1.)

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest --project unit run src/lib/classColors.test.ts
```
Expected: 6 new tests fail with `getSliceColors is undefined`.

- [ ] **Step 3: Implement `getSliceColors`**

In `activity/src/lib/classColors.ts`, add this above the `__test` export:

```ts
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

export function getSliceColors(
  className: CharacterClass | null | undefined,
  variationIndex: number,
): SliceColors {
  const baseHex = className ? CLASS_COLORS[className] : NULL_CLASS_FALLBACK;
  const { h, s, l } = hexToHsl(baseHex);
  const shifted = clamp(l + lightnessOffsetForIndex(variationIndex), 18, 85);
  const fill = hslToHex(h, s, shifted);

  const active = pickTextPair(fill);

  // For the chosen state, grayscale(0.95) collapses the fill to (effectively)
  // its luminance. Build a grey hex with that luminance and pick contrast
  // against it — so dark class colors (DK red, DH purple) get white chosen
  // text and light ones (Priest, Rogue) get black.
  const lum = relativeLuminance(fill);
  // sRGB inverse gamma to get a perceptually-matched grey hex.
  const greyByte = Math.round(Math.pow(lum, 1 / 2.4) * 255);
  const clamped = Math.min(255, Math.max(0, greyByte))
    .toString(16)
    .padStart(2, '0');
  const greyHex = `#${clamped}${clamped}${clamped}`;
  const chosen = pickTextPair(greyHex);

  return {
    fill,
    textFill: active.fill,
    textStroke: active.stroke,
    chosenTextFill: chosen.fill,
    chosenTextStroke: chosen.stroke,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest --project unit run src/lib/classColors.test.ts
```
Expected: 13 tests passing total. Pay particular attention to the contrast-loop tests — if any class fails, the failure list will name it. If a contrast assertion fails, the variation step (8%) or the lightness clamp (`[18, 85]`) is the lever to adjust; do not weaken the 4.5:1 threshold.

- [ ] **Step 5: Commit**

```bash
git add activity/src/lib/classColors.ts activity/src/lib/classColors.test.ts
git commit -m "feat(activity): add getSliceColors with WCAG-correct text color"
```

---

## Task 4: Wire `getSliceColors` into `Wheel.tsx`

**Files:**
- Modify: `activity/src/components/Wheel.tsx`
- Modify: `activity/src/index.css` (lines around 1228–1250)

Drop the hard-coded `SLICE_COLORS` palette. Compute one `variationIndex` per entry via `useMemo`, call `getSliceColors`, push the fill into the `<path>` and the four text colors into CSS custom properties on the slice `<g>`.

- [ ] **Step 1: Update `Wheel.tsx` imports and remove the old palette**

In `activity/src/components/Wheel.tsx`:

Change the import line:
```ts
import { getClassColor } from '../lib/classColors';
```
to:
```ts
import { getClassColor, getSliceColors } from '../lib/classColors';
```

Delete the `SLICE_COLORS` constant (lines 24–28):
```ts
const SLICE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff9800',
];
```

- [ ] **Step 2: Compute per-class variation indices**

After the `winnerIndex` `useMemo` block (around line 102–106), add:

```tsx
const variationIndices = useMemo(() => {
  const counts = new Map<string, number>();
  return entries.map((entry) => {
    const key = entry.characterClass ?? '__null__';
    const idx = counts.get(key) ?? 0;
    counts.set(key, idx + 1);
    return idx;
  });
}, [entries]);
```

- [ ] **Step 3: Use `getSliceColors` in the slice `.map()`**

In the `entries.map((entry, i) => …)` block (around line 315), replace:

```tsx
const baseColor = SLICE_COLORS[i % SLICE_COLORS.length];
```

with:

```tsx
const sliceColors = getSliceColors(entry.characterClass, variationIndices[i]);
```

Then replace the slice `<g>` opening tag and `<path>` element to thread CSS vars + the new fill. Replace this block:

```tsx
return (
  <g key={`${role}-slice-${i}`} className={sliceClass}>
    <path
      className="wheel-slice__fill"
      d={sliceArcPath(0, 0, RADIUS, startAngle, endAngle)}
      fill={baseColor}
    />
    <text
      className="wheel-slice__label"
      x={textAnchorX}
      y={0}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      transform={`rotate(${textRotDeg})`}
    >
      {displayName}
    </text>
  </g>
);
```

with:

```tsx
const sliceStyle = {
  '--slice-text': sliceColors.textFill,
  '--slice-text-stroke': sliceColors.textStroke,
  '--slice-text-chosen': sliceColors.chosenTextFill,
  '--slice-text-stroke-chosen': sliceColors.chosenTextStroke,
} as CSSProperties;

return (
  <g key={`${role}-slice-${i}`} className={sliceClass} style={sliceStyle}>
    <path
      className="wheel-slice__fill"
      d={sliceArcPath(0, 0, RADIUS, startAngle, endAngle)}
      fill={sliceColors.fill}
    />
    <text
      className="wheel-slice__label"
      x={textAnchorX}
      y={0}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      transform={`rotate(${textRotDeg})`}
    >
      {displayName}
    </text>
  </g>
);
```

- [ ] **Step 4: Update CSS to consume the custom properties**

In `activity/src/index.css`, replace the `.wheel-slice__label` block (lines 1228–1238):

```css
.wheel-slice__label {
  fill: #fff;
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  paint-order: stroke fill;
  stroke: rgba(0, 0, 0, 0.9);
  stroke-width: 0.3;
  filter: drop-shadow(0 0.4px 0.6px rgba(0, 0, 0, 0.75));
  transition: opacity 200ms ease-out;
  pointer-events: none;
}
```

with:

```css
.wheel-slice__label {
  fill: var(--slice-text, #fff);
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  paint-order: stroke fill;
  stroke: var(--slice-text-stroke, rgba(0, 0, 0, 0.9));
  stroke-width: 0.3;
  filter: drop-shadow(0 0.4px 0.6px rgba(0, 0, 0, 0.75));
  transition: opacity 200ms ease-out;
  pointer-events: none;
}
```

And replace the `.wheel-slice--chosen .wheel-slice__label` block (lines 1247–1250):

```css
.wheel-slice--chosen .wheel-slice__label {
  fill: rgba(0, 0, 0, 0.6);
  stroke: none;
}
```

with:

```css
.wheel-slice--chosen .wheel-slice__label {
  fill: var(--slice-text-chosen, rgba(0, 0, 0, 0.6));
  stroke: var(--slice-text-stroke-chosen, none);
}
```

- [ ] **Step 5: Run typecheck**

```
cd activity && npm run typecheck
```
Expected: 0 errors. If TS complains about the `as CSSProperties` cast on an object containing `--slice-*` keys, ensure the local cast is exactly `as CSSProperties` (React's type accepts arbitrary `--*` keys via this cast — same pattern is already used in `Wheel.tsx`'s `WinnerPortrait` for `--wp-color`).

- [ ] **Step 6: Run build + storybook build**

```
cd activity && npm run build && npm run build-storybook
```
Expected: both succeed. Storybook build exercises the `Wheel.stories.tsx` fixtures, so any runtime regression in the slice render path fails here.

- [ ] **Step 7: Manual visual sanity check (optional but recommended)**

Run Storybook locally and eyeball the wheel:
```
cd activity && npm run storybook
```
Open http://localhost:6006, navigate to "Wheel / Wheel". Verify:
- Slice colors match WoW class colors (DK red, Mage cyan, Druid orange, etc.).
- Two slices of the same class look distinct (e.g., the DPS pool has three Mages and three Hunters).
- Player names remain readable on every slice — no white-on-white (Priest), no white-on-yellow (Rogue).
- The "Idle — with chosen + offspec slices" story still reads correctly: chosen slices are grey with legible dark text.

Stop the dev server (Ctrl-C) when done.

- [ ] **Step 8: Commit**

```bash
git add activity/src/components/Wheel.tsx activity/src/index.css
git commit -m "feat(activity): class-colored wheel slices with dynamic text legibility"
```

---

## Task 5: Regenerate Playwright snapshots

**Files:**
- Modify: contents of `activity/tests/__screenshots__/` (regenerated)

The wheel visual changes — every snapshot that includes a wheel will diff. Per CLAUDE.md, snapshots MUST be regenerated inside the Docker Playwright runner.

- [ ] **Step 1: Regenerate snapshots in Docker**

From the project root:
```
./scripts/playwright-docker.sh --update-snapshots
```
Expected: command finishes successfully; `git status` shows modified/added `.png` files under `activity/tests/__screenshots__/`.

- [ ] **Step 2: Re-run Playwright to verify the regenerated snapshots match**

```
./scripts/playwright-docker.sh
```
Expected: all tests pass (no diff vs the snapshots we just generated).

- [ ] **Step 3: Spot-check 1-2 regenerated screenshots**

Open at least one updated `.png` under `activity/tests/__screenshots__/` (any wheel-containing snapshot — `wheelsGrid.spec.ts*` or `pages.spec.ts*` outputs are good candidates). Visually confirm:
- Slices show class colors.
- Same-class slices are slightly different shades.
- Text is legible on every slice (no invisible labels).

If anything looks wrong, do NOT just regenerate — go back to Task 4 and fix the bug, then redo Task 5.

- [ ] **Step 4: Commit regenerated snapshots**

```bash
git add activity/tests/__screenshots__/
git commit -m "test(activity): refresh wheel snapshots for class-colored slices"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run the full frontend verify script**

From the project root:
```
./scripts/verify-activity.sh
```
Expected: all five steps pass — install (or skip), typecheck, build, storybook build, Playwright tests.

- [ ] **Step 2: Run unit tests one more time**

```
cd activity && npx vitest --project unit run
```
Expected: all tests pass, including the `classColors.test.ts` suite added in Tasks 1–3.

- [ ] **Step 3: Skim `git log` for the feature**

```
git log --oneline main..HEAD
```
Expected: 5 commits (one per task that produced commits — Tasks 1, 2, 3, 4, 5).

If you see anything unexpected (extra commits, missing tests, lint failures), fix and re-verify before declaring done.

---

## Acceptance criteria (cross-check before declaring done)

- [ ] `SLICE_COLORS` no longer exists in `Wheel.tsx`.
- [ ] Each entry's slice fill is derived from `getClassColor(entry.characterClass)` via `getSliceColors`, with a per-class variation index stable for the lifetime of the current `entries` array.
- [ ] Null-class entries render as a varied grey, not a hardcoded palette color.
- [ ] Unit test `classColors.test.ts` proves ≥ 4.5:1 contrast for every (class ∪ null) × variationIndex(0..4) pair, in both active and chosen states.
- [ ] Playwright snapshots regenerated inside Docker and committed.
- [ ] `./scripts/verify-activity.sh` passes end-to-end.

## Self-review notes

- Spec section 1 (variation derivation) → Task 4 step 2.
- Spec section 2 (HSL shift) → Task 1 + Task 3 step 3.
- Spec section 3 (null fallback) → Task 3 step 3 (`NULL_CLASS_FALLBACK`) + Task 3 step 1 test.
- Spec section 4 (dynamic text) → Task 2 + Task 3 (`pickTextPair`).
- Spec section 5 (code shape) → Tasks 3, 4.
- Spec section 6 (edge cases) → covered by Task 3 contrast loop (chosen state) and Task 4 step 7 (visual check including offspec).
- Spec section 7 (testing) → Tasks 1, 2, 3, 5.
- All function/property names match across tasks: `getSliceColors`, `SliceColors`, `fill`, `textFill`, `textStroke`, `chosenTextFill`, `chosenTextStroke`, `--slice-text`, `--slice-text-stroke`, `--slice-text-chosen`, `--slice-text-stroke-chosen`, `variationIndices`.
