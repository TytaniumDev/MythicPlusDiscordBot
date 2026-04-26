# Results View Carousel Redesign

## Background

The current `/activity` results view (`activity/src/views/ResultsView.tsx`) renders the same group information twice: once as the prominent spotlight portraits at the top (only the viewer's group) and again as a list of compact `GroupCard` text rows at the bottom (all groups). Stacked together with the affixes header and the Suggested Keys panel, the layout pushes the "New Round" button below the fold on common viewport sizes (e.g., 1440×900 desktop, the Discord activity iframe).

This redesign consolidates the two redundant group representations into a single horizontally-paged carousel. Each carousel slide unifies role icons, utility icons, character portraits, names, and the Copy Invite affordance for one group. Adjacent groups peek on either side at reduced scale and opacity, with arrows and swipe to navigate. The Suggested Keys panel sits below the carousel and re-scopes its computation to whichever group is currently in view.

## Goals

- Eliminate the duplicate per-group rendering on the results view.
- Fit the affixes bar, results content, and the New Round button on a typical 1440×900 desktop and a 720p-class Discord activity iframe without scrolling.
- Reuse a single `GroupSlide` component for any group (complete or remainder).
- Tie the Suggested Keys panel to the actively viewed group so it is meaningfully scoped, animating in concert with the carousel.

## Non-goals

- Redesigning the wheel reveal flow (`SpotlightCard`, `WheelsView`). It still uses the existing `SpotlightPortrait` and `GroupCard` components.
- Changing `useDungeonSuggestions` semantics other than the input scope (active group instead of viewer's group).
- Backwards-compatibility shims for removed components — `SpotlightPortraits` and `MobileGroupPager` are deleted outright.

## High-level layout

Top-to-bottom on the results view:

1. `HeaderBar` ("All Groups Formed!") — unchanged.
2. `AffixBar` — unchanged.
3. **`GroupCarousel`** (new) — replaces both the previous `SpotlightPortraits` block and the `final-groups`/`MobileGroupPager` block.
4. `DungeonSuggestions` (existing) — recomputed for the active carousel slide; cross-fades when the active slide changes.
5. New Round button + report-success status — unchanged.

## Components

### `GroupSlide` (new)

`activity/src/components/GroupSlide.tsx`

A single visual unit for one group. Layout, top to bottom:

- **Heading:** group label (e.g., `Group 1`, `Remainder`).
- **Role-icon row** — five fixed-width cells. Each cell shows a small circular role icon: Tank / Healer / DPS, color-matched to the existing `--color-tank` / `--color-healer` / `--color-dps` tokens. Off-spec slots get a subtle off-spec marker that mirrors the existing `RoleRow` `isOffspec` styling. Empty role slots in a remainder group render a dim/placeholder icon so columns stay aligned across all five positions.
- **Utility-icon row** — five fixed-height cells. Cells whose player has `hasBrez` / `hasLust` show the matching utility emoji-icons used today by `utilityIcons(player)`. Cells without utilities render an empty placeholder of the same height so utility icons align horizontally across all players.
- **Portrait row** — five `SpotlightPortrait` instances (one per slot), preserving the existing class-color glow, fallback avatar, and Raider.io tooltip. Empty slots in a remainder render a faded placeholder portrait.
- **Name row** — class-colored player names (existing styling).
- **Copy Invite button** — centered below the portraits, larger than the current per-card `btn-copy-invite`. Hidden when `generateInviteCommand` returns an empty string (e.g., remainder with no real invite, or a single-player group). "Copied!" feedback retained.

Props:

```ts
interface GroupSlideProps {
  group: WoWGroup;
  index: number;             // 0-based; used for default heading numbering
  label?: string;            // override heading (e.g., "Remainder")
  scoresByDiscordId?: ReadonlyMap<string, CharacterDungeonScores | null>;
}
```

The slide is purely presentational; it does not own scroll/active state.

### `GroupCarousel` (new)

`activity/src/components/GroupCarousel.tsx`

Wraps a list of slides and manages active-index navigation.

- **Layout:** active slide centered at full size; the immediately previous and next slides peek on the sides at ~75% scale and ~40% opacity. Slides further away are positioned off-canvas and clipped (carousel viewport has `overflow: hidden`).
- **Navigation:**
  - Left/right arrow buttons flanking the active slide; disabled at the ends (no wrap-around).
  - Keyboard `ArrowLeft` / `ArrowRight` when the carousel viewport is focused.
  - Click on a peeked side slide to jump to it.
  - Touch swipe (horizontal pointer drag with a small threshold) on mobile.
- **Transition:** CSS `transform` + `opacity` transition, ~250ms ease-out, so slides slide-and-fade in unison.
- **Active-index control:**
  - Accepts a controlled `activeIndex` + `onActiveIndexChange` so `ResultsView` can lift state and drive the suggestions panel.
  - On mount, the parent seeds `activeIndex` to `yourGroupIndex` (or `0` if the viewer is not in any group).
- **Accessibility:** an `aria-live="polite"` region announces "Group N of M" when the active index changes; arrow buttons have `aria-label="Previous group"` / `"Next group"`; keyboard focus on the viewport receives a visible focus ring.
- **Single-group case:** when there is only one slide, side peeks and arrows are hidden.

Props:

```ts
interface GroupCarouselProps {
  groups: ReadonlyArray<{ group: WoWGroup; index: number; label?: string }>;
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  scoresByDiscordId?: ReadonlyMap<string, CharacterDungeonScores | null>;
}
```

## Suggested Keys integration

`useDungeonSuggestions` is called once today with a scope of the viewer's group (falling back to all grouped players for spectators). After this redesign the active carousel slide drives the scope:

- `ResultsView` lifts `activeSlideIndex`, seeded from `yourGroupIndex` (or `0`).
- It derives `activeGroupPlayers` from `groups[activeSlideIndex]` — `tank` + `healer` + `dps`, filtering out null slots.
- `useDungeonSuggestions(activeGroupPlayers, keyLevel)` re-runs as the slide changes.
- For a remainder slide whose group is incomplete, `DungeonSuggestions` shows an "Suggestions unavailable — incomplete group" state instead of ranking against 1–2 players. (We add a single conditional inside `ResultsView` rather than hard-changing `DungeonSuggestions`; the existing horizontal layout is reused.)
- The panel wrapper applies a CSS opacity transition (~150ms cross-fade) keyed on `activeSlideIndex`. Panel height is held stable so cross-fading does not jolt the layout.

## Vertical density & responsiveness

- The carousel uses `clamp()` for portrait size and slide-internal gaps so it scales down on shorter viewports (target: portrait size ~140px on tall desktops, shrinking toward ~96px around 800px viewport height).
- Affixes-bar padding is tightened slightly to recover a few pixels of vertical room.
- On viewports narrower than ~640px the active slide expands to ~85% of the carousel width and side peeks shrink to slim edge previews (~7% each); arrow buttons remain. `DungeonSuggestions` continues to use its existing `layout="horizontal"` mode and scrolls horizontally.
- Acceptance check: on a 1440×900 desktop and on a 720p-tall iframe the New Round button is visible without scroll. This will be verified manually with the dev server before snapshot regeneration.

## Files

**Added**

- `activity/src/components/GroupSlide.tsx`
- `activity/src/components/GroupSlide.stories.tsx`
- `activity/src/components/GroupCarousel.tsx`
- `activity/src/components/GroupCarousel.stories.tsx`

**Modified**

- `activity/src/views/ResultsView.tsx` — replace `SpotlightPortraits` + `final-groups` map with `<GroupCarousel>`; lift `activeSlideIndex`; derive per-slide suggestions; conditional empty state for remainder slides.
- `activity/src/views/ResultsView.stories.tsx` — update fixtures for the new layout.
- `activity/src/styles.css` — new carousel/slide styles; remove styles for deleted components.

**Deleted**

- `activity/src/components/SpotlightPortraits.tsx`
- `activity/src/components/SpotlightPortraits.stories.tsx` (if present; otherwise n/a)
- `activity/src/components/MobileGroupPager.tsx`
- `activity/src/components/MobileGroupPager.stories.tsx`

**Untouched**

- `activity/src/components/SpotlightPortrait.tsx` (singular) — reused inside `GroupSlide`.
- `activity/src/components/GroupCard.tsx` — still used by the wheel reveal flow.

## Tests

- New Storybook stories for `GroupSlide`: complete group, remainder with empty slots, off-spec marker on a DPS slot, no-invite case (Copy Invite hidden).
- New Storybook stories for `GroupCarousel`: three complete groups + remainder, viewer-centered initial slide, single-group case, navigation interactions.
- Updated `ResultsView.stories.tsx`.
- Playwright visual snapshots regenerated via `./scripts/playwright-docker.sh --update-snapshots` and committed alongside the code changes.

## Risks & open questions

- **Touch-swipe on Discord iframe.** The activity runs inside Discord's iframe; pointer events should pass through normally, but a quick manual smoke on the Pi-deployed activity is worth doing once the change is live.
- **Active-index seeding race.** When the results view first mounts, `yourGroupIndex` is computed from `currentPlayerId`, which may briefly be unresolved on cold loads. Using `Math.max(0, yourGroupIndex)` for the initial value keeps the carousel on slide 0 in that window without a flash.
- **Remainder Suggested Keys empty state copy.** The exact wording of the empty state is left for implementation; the spec only requires that incomplete groups don't get a misleading ranking.
