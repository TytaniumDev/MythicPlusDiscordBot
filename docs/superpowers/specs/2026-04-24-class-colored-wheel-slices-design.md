# Class-Colored Wheel Slices

## Goal

Replace the wheel's generic 12-color palette with WoW class colors, with per-class shade variation so multiple players of the same class don't render identically. Text labels must remain legible (≥ 4.5:1 contrast, WCAG AA) on every fill.

## Today

`activity/src/components/Wheel.tsx` picks slice fills from a hard-coded `SLICE_COLORS` array, indexed by slice position. Class is already plumbed through `WheelEntry.characterClass`, and `lib/classColors.ts` exposes `getClassColor()` returning the official Blizzard color per class. Labels are white text with a dark outline (`paint-order: stroke fill`) — fine for the mid-tone palette in use today, but inadequate for class colors that include pure white (Priest), bright yellow (Rogue), and several light greens/blues.

## Design

### 1. Shade derivation — per-class index in current entries

For each entry in the wheel's `entries` array, count how many earlier entries share its class. That count is the entry's `variationIndex`. The current `entries` array is set at `init()` and frozen during a spin, so shades are stable for the duration of a round and re-shuffle naturally when a new round seeds new entries.

Computed once via `useMemo` keyed on `entries`:

```ts
const variationIndices = useMemo(() => {
  const counts = new Map<string, number>();
  return entries.map((e) => {
    const key = e.characterClass ?? '__null__';
    const idx = counts.get(key) ?? 0;
    counts.set(key, idx + 1);
    return idx;
  });
}, [entries]);
```

### 2. Shade math — HSL lightness shift

Convert the base class color to HSL, shift lightness by an alternating series:

| variationIndex | offset |
|----------------|--------|
| 0              |   0%   |
| 1              |  −8%   |
| 2              |  +8%   |
| 3              | −16%   |
| 4              | +16%   |
| n              | `(n+1 >> 1) * 8%` with sign `(-1)^n` |

Resulting lightness is clamped to `[18%, 85%]` so very light classes (Priest, Rogue) don't blow to pure white and very dark shifts don't crush into the wheel border. Hue and saturation are preserved.

### 3. Null class fallback

For entries with `characterClass === null`, use a neutral grey base (`#7a7a8a`) and apply the same lightness shift. This keeps unknown-class entries visually distinct from class-colored ones while still varying.

### 4. Text legibility — dynamic per slice

For each shaded fill, compute WCAG relative luminance and pick the text treatment with the higher contrast ratio against the fill:

- If contrast(black, fill) > contrast(white, fill): `textFill = '#000'`, `textStroke = 'rgba(255,255,255,0.85)'`
- Otherwise: `textFill = '#fff'`, `textStroke = 'rgba(0,0,0,0.9)'`

This is WCAG-correct (no fixed luminance cutoff) and handles the borderline cases (Demon Hunter purple, Shaman blue) where black-vs-white isn't obvious by eye.

### 5. Code shape

**`activity/src/lib/classColors.ts`** — extend with:

```ts
export interface SliceColors {
  fill: string;          // shaded class color
  textFill: string;      // '#000' or '#fff'
  textStroke: string;    // complementary stroke color
}

export function getSliceColors(
  className: CharacterClass | null,
  variationIndex: number,
): SliceColors;

// Internal helpers (not exported):
//   hexToHsl, hslToHex, relativeLuminance, contrastRatio
```

**`activity/src/components/Wheel.tsx`** — drop `SLICE_COLORS`. Compute `variationIndices` via `useMemo`. For each slice, call `getSliceColors(entry.characterClass, variationIndices[i])`. Pass `fill` to the path; attach `--slice-text` and `--slice-text-stroke` as CSS custom properties on the slice `<g>`.

**`activity/src/index.css`** — change:

```css
.wheel-slice__label {
  fill: var(--slice-text, #fff);
  stroke: var(--slice-text-stroke, rgba(0,0,0,0.9));
  /* paint-order, font, etc. unchanged */
}
```

The `.wheel-slice--chosen` rule's hard-coded `fill: rgba(0, 0, 0, 0.6)` becomes a problem because grayscale of dark class colors (DK red, DH purple, Warlock indigo) lands too dark for black text. Resolution: compute the grayscale-equivalent luminance for the chosen state inside `getSliceColors` and emit a `chosenTextFill` / `chosenTextStroke` pair too — applied via separate custom properties (`--slice-text-chosen`, `--slice-text-stroke-chosen`) consumed by the chosen-state CSS rule.

### 6. Edge cases

- **Empty entries / no candidates state**: unchanged. The existing `<circle fill="#1a1a2e">` empty state never reaches the new code.
- **Chosen / offspec / loser / winner state filters**: the existing CSS filters (`grayscale`, `saturate`, `brightness`) compose on top of the new fills the same way they did on the old palette. The grayscale-aware text logic above covers the chosen state; offspec/loser/winner only adjust opacity or apply uniform brightness, so contrast remains acceptable.
- **`isOffspec` slices**: filter is `saturate(0.35) brightness(0.75)`. The fill darkens uniformly, so the dark-text-on-light-fill case (e.g., shaded Priest white) still has enough contrast under the filter. Verify in the WCAG unit test by also asserting contrast on `brightness(0.75)`-equivalent luminance.
- **Color-blind users**: class color is one of multiple identifiers (name, portrait on win) — the wheel does not rely on color alone to convey identity, so red/green confusion does not block use.

### 7. Testing

- **Unit test** `getSliceColors` (`activity/tests/` or co-located):
  - Same input → identical output (deterministic).
  - Same class with different variation indices → different outputs.
  - For every `CharacterClass` ∪ {null} and every `variationIndex` in `[0, 4]`: contrast ratio between `textFill` and `fill` is ≥ 4.5:1.
  - Lightness offsets clamp at the boundaries (verify Priest white at index 2 doesn't exceed L=85%).
- **Playwright snapshot regen**: `./scripts/playwright-docker.sh --update-snapshots`. The wheel visuals change, so committed screenshots must be regenerated.

### 8. Out of scope

- Changing class colors themselves.
- Reskinning chosen / offspec / loser / winner state filters.
- Adding portrait-side colorization (already class-tinted via `--wp-color`).
- Color preferences / accessibility opt-out (high-contrast mode). Future work if requested.

## Risks

- **Lightness clamp truncates variation when many same-class entries exist.** With Priest's base at 100% lightness and a 18%–85% clamp, every Priest variation lands ≤ 85% — they won't span the full series. Acceptable: visual difference between adjacent shades is still discernible, and large same-class groups are rare in a 5-player Mythic+ wheel.
- **Grayscale text-color computation for the chosen state adds two more CSS custom properties.** Verifiable, but worth noting that the chosen state's CSS gets slightly more complex.
