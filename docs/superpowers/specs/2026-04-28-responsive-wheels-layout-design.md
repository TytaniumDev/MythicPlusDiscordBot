# Responsive Wheels Layout — Design

**Date:** 2026-04-28
**Status:** Approved (pending user spec review)
**Scope:** `activity/` — `WheelsView`, `WheelsGrid`, `GroupCard`, layout CSS

## Problem

In thin/tall windows — including the embedded Discord activity case — the wheels view wastes space. Two specific issues:

1. The `Groups` side panel is reserved on the right at all viewport shapes, eating ~225–280px of horizontal room even when the wheel grid is the binding constraint.
2. The 5 wheels are forced to a single 6-column grid where every slot spans the same width. In width-limited (portrait) windows, the bottom DPS row and the top tank/healer row end up the same diameter, but the grid is small overall — the wheels feel cramped and a lot of vertical room goes unused.

The user wants the wheels to fill the visible area more aggressively, especially in portrait windows like the embedded Discord activity.

## Goals

- Maximize wheel size at all viewport aspect ratios.
- Minimize layout motion *during* the spin sequence — the layout decision is made once per viewport size.
- Preserve the "tank/healer on top, 3 DPS on bottom" stack as an invariant — no auto-flow to 5-in-a-row or other arrangements.

## Non-goals

- No active-wheel emphasis (no resizing during the spin).
- No restructuring of carousel mode (≤599px). That breakpoint and its single-wheel pager remain unchanged.
- No new layout for the lobby/results views.

## Design

### Layout decision

A single CSS-only switch selects between two layouts based on viewport aspect ratio:

- **Landscape** (viewport width:height ≥ ~1.2:1): groups panel docked to the **right**, ~240–280px wide. Wheel area takes the rest of the horizontal space. Equivalent to today's layout.
- **Portrait** (viewport width:height < ~1.2:1): groups panel docked to the **bottom** as a horizontal strip ~140–180px tall. Wheel area takes the full viewport width.
- **Carousel** (viewport width ≤ 599px): single-wheel `MobileGroupPager` experience overrides the above. Unchanged from today.

The decision is made via CSS aspect-ratio media/container queries; resizing the window is the only thing that re-runs it. The 1.2:1 threshold is tweakable while iterating in Storybook.

### Wheel sizing — per-row, fill-the-row

Each row sizes its wheels to fill its own width (instead of the current shared 6-column grid where all 5 slots are equal width):

- **Top row:** 2 wheels, each diameter ≈ `(rowWidth − gap) / 2`, capped at row height (so they remain square via `aspect-ratio: 1`).
- **Bottom row:** 3 wheels, each diameter ≈ `(rowWidth − gap) / 3`, capped at row height.
- In width-limited (portrait) windows: tank/healer end up ~50% larger than DPS. This is the intended visual hierarchy — tank/healer are the "primary" picks and become naturally larger when width is the binding constraint.
- In wide-enough landscape windows: row heights become the binding constraint and both rows converge on the same diameter.

The current single-grid approach (`grid-template-columns: repeat(6, 1fr)` with each slot spanning 2 cols) is replaced by two row-level containers — top row a 2-column grid, bottom row a 3-column grid. Both rows split the wheel-area height equally (`1fr 1fr`).

### Reclaiming vertical space inside slots

Two specific places currently subtract from wheel diameter:

1. **Label badges** (`TANK`/`HEALER`/`DPS` above each wheel) and **result text** (winner name in gold below each wheel) sit in `.wheel-slot` flex children. Today the result text expands the slot when the name wraps, which can shrink the wheel.
   - Fix: lock the result-text row to a fixed height (e.g., a `min-height` based on the line height of one line of bold gold text). Multi-line names truncate or shrink-to-fit instead of pushing the wheel smaller.
   - Fix: the label badge's vertical padding is reduced slightly so the wheel inherits more of the slot's height.
2. **`.wheels-area`'s outer centering** (`align-items: center; justify-content: center`) combined with `flex: 1` on `.wheels-container` is fine when content fills, but currently leaves a thin ring of padding. The grid is locked to `width: 100%; height: 100%` and the centering bias is removed; wheel sizing math drives the layout instead.

### Groups panel — bottom-strip variant

When docked to the bottom in portrait mode:

- Strip height: ~140–180px, single row of cards, with a small `Groups` label header.
- Cards: horizontal flex row, scrollable horizontally (touch swipe + scrollbar) when there are more cards than fit.
- Card shape: a new `strip` variant of `GroupCard` (or an extension of the existing `compact` mode). Stamp-sized horizontal block with the group index, role-tinted player chips in a row, and any group-level utility/icon row.
- Empty state: the strip is always reserved so the wheels' size doesn't change when the first card lands. Before any cards arrive the strip shows just the `Groups` header on a flat background — no pop-in of the strip itself, only individual cards appearing inside it as groups complete.

### Carousel mode (unchanged)

At viewport width ≤ 599px the existing `MobileGroupPager` and single-wheel carousel stay in place, irrespective of aspect ratio. The portrait/landscape switch only takes effect above the carousel breakpoint.

## Files touched

- `activity/src/index.css` — layout rules for `.wheels-content` (aspect-ratio swap), `.wheels-container` (per-row grid), `.side-panel` (horizontal-strip variant), `.wheel-slot` text overhead.
- `activity/src/components/WheelsGrid.tsx` — split the single grid into top-row + bottom-row containers.
- `activity/src/components/GroupCard.tsx` — strip variant (or extension of `compact`) for horizontal layout.
- `activity/src/views/WheelsView.tsx` — minimal: lets CSS decide layout placement. Keeps `useIsCarouselMode` for the ≤599px override.
- `activity/src/views/WheelsView.stories.tsx` — stories at tall portrait (e.g., 600×1200), square-ish (900×900), wide landscape (1600×900), and the existing carousel size.
- `activity/src/components/GroupCard.stories.tsx` — story for the strip variant.

## Edge cases

- **Window resized across the 1.2:1 threshold mid-spin:** CSS-only swap. Wheels area resizes; wheels shrink/grow to fit. Spin animation continues — no JS-side state to reconcile.
- **Square-ish windows (1.0:1 to 1.2:1):** fall on the portrait side; panel docks at the bottom. Threshold tunable from Storybook.
- **Very wide landscape (e.g., 2400×900):** panel on right. Wheels become height-limited; tank/healer ≈ DPS diameter at the natural ceiling.
- **No groups revealed yet:** strip exists, empty (or just the `Groups` header). Wheels size as if the strip is present.
- **Many groups revealed (5+):** strip scrolls horizontally; carousel mode is unaffected.

## Testing

- Add Storybook stories at: 600×1200, 900×900, 1600×900, plus the existing carousel size. Each story should render `WheelsView` mid-spin (or just-completed) so the visual is meaningful.
- Add a Storybook story for the strip variant of `GroupCard`.
- Regenerate Playwright visual snapshots via `./scripts/playwright-docker.sh --update-snapshots` and commit the updated `activity/tests/__screenshots__/`.
- Existing carousel-mode tests should be unchanged.

## Out of scope / follow-ups

- Equal-size wheels (Approach 2 from brainstorming) — explicitly rejected in favor of per-row "fill the row" sizing for the visual hierarchy benefit. Could revisit later as an option.
- Per-spin active-wheel emphasis — explicitly rejected to keep the experience calm.
- Lobby/results view layout work.
