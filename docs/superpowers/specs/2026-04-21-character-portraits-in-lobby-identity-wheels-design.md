# Character Portraits in PlayerChip, IdentityView, and Wheel Landing

**Status:** Design approved 2026-04-21
**Scope:** Activity frontend (`activity/`) — no bot or shared-package changes.

## Summary

With portraits now guaranteed for players who have a linked WoW character (via the weekly refresh + inGameName backfill introduced in #414–#416), three UI surfaces that currently lack them should start using them:

1. **`PlayerChip`** (lobby player list) — add a leading round portrait to the chip.
2. **`IdentityView`** identity cards (the "pick who you are" screen) — swap the letter initial for a portrait when a mapping exists.
3. **Wheel landing** — after each wheel lands on its winner, expand a round head-shot portrait from the hub outward, replacing the canvas wheel with a big portrait before the existing `SpotlightCard` sequence runs.

All three use a letter / `?` fallback when `mediaUrl` is null, so the features degrade gracefully for players without a linked character (still possible in demo mode, for freshly joined players, or on a lookup failure).

## Goals / Non-goals

**Goals**
- Make player identity recognizable at a glance in the lobby.
- Make the self-identity picker visually distinctive (photos beat letters for self-recognition).
- Give each wheel landing a character-driven visual payoff *per role*, complementing (not replacing) the existing `SpotlightCard` reveal.
- Preserve all existing timings, orchestration, and accessibility guarantees.

**Non-goals**
- No changes to the bot, Firestore schema, or `WoWPlayer` shape.
- No redesign of `PlayerCard` (the drawer/edit view); it already uses `CharacterHeader` with a portrait.
- No replacement of `SpotlightCard` / `SpotlightPortraits`. The full-body spotlight after each group still happens.
- No new Blizzard asset variants — we reuse the existing `-avatar.jpg` (head shot) and `-inset.jpg` / `-main-raw.png` URLs already in Firestore via the `toAvatarUrl` / `toMainBodyUrl` helpers.
- No Discord activity proxy changes — portraits are already routed through `remapImageUrl`.

## Design decisions (locked)

From the brainstorming conversation, the user locked these picks:

| Surface | Choice |
|---|---|
| Wheel portrait variant + framing | **A**: round head-shot (`-avatar.jpg`) |
| Wheel timing | **X**: expand after the existing gold-glow fade-in; existing SpotlightCard sequence still runs |
| PlayerChip treatment | **P2**: leading ~34px portrait with class-color ring; name + tags stack to the right |
| IdentityView treatment | **I2**: replace initial with portrait and bump avatar size, trim card padding so grid density stays |
| Null-`mediaUrl` fallback (wheel) | **F2**: colored fallback circle still plays the expand animation |

## Architecture

### Data plumbing

`WheelEntry` currently carries only `{ name, isOffspec, isChosen }`. Extend it to include:

```ts
export interface WheelEntry {
  name: string;
  isOffspec: boolean;
  isChosen: boolean;
  mediaUrl: string | null;          // new
  characterClass: CharacterClass | null;  // new
}
```

`initPools` in `activity/src/lib/roles.ts` populates the new fields from the source `WoWPlayer` objects. `WheelsGrid.initWheels` / `updatePools` forward them unchanged.

`PlayerChip` gains two new props:

```ts
mediaUrl?: string | null;
characterClass?: CharacterClass | null;
```

`LobbyView` already has the full `WoWPlayer` at each chip render site — it just forwards these fields.

`IdentityView` already renders from `WoWPlayer` objects in `channelData.players`, so it reads `player.mediaUrl` / `player.characterClass` directly. No new prop threading needed.

### Wheel animation (`activity/src/lib/wheel.ts`)

The `Wheel` class is canvas-based and builds its DOM programmatically. We add a DOM overlay on top of the canvas rather than drawing the portrait into the canvas — this keeps image loading, `<img>` error handling, and CSS transitions simple.

**Constructor additions:**
- Append a new `<div class="wheel-portrait">` into the existing `wheel-frame`, absolutely positioned to fill the frame, starting at `scale(0); opacity: 0`.
- Inside it, an `<img class="wheel-portrait__img">` and a sibling `<div class="wheel-portrait__fallback">` for the F2 fallback path. Exactly one is shown based on whether a valid `mediaUrl` is available.
- Expose the overlay element as a private field; do *not* add it to the canvas's accessibility tree (the canvas already has `role="img"` + aria labels).

**New methods:**

```ts
// Swap image src, set ring/class color, trigger expand animation.
// Resolves after PORTRAIT_EXPAND_DURATION ms.
async revealPortrait(duration: number): Promise<void>;

// Called from init(): hide overlay and clear classes so the next group's
// wheel starts with no residual portrait.
clearPortrait(): void;
```

`revealPortrait` is invoked from inside `spinTo` **after** the existing gold-glow fade-in animation completes and **before** the promise resolves. This means:
- Grid mode: all 5 wheels animate their portraits in parallel as each lands (DPS wheels already stagger by 300/600ms, so the visual cascade reads naturally).
- Carousel mode: each wheel's portrait expands while it's the active slide, before the carousel advances.

**Portrait content:**
- When `entry.mediaUrl` is present, `<img>` src is set to `remapImageUrl(toAvatarUrl(mediaUrl))`. `onerror` hides the img and shows the fallback div (same pattern `SpotlightPortrait` uses today).
- Fallback div shows a single letter (first char of `entry.name`) or `?` colored with the class color from `getClassColor(entry.characterClass) ?? '#808080'`.
- The outer overlay uses the class color as a border ring — consistent with `SpotlightPortrait` and `CharacterHeader`.

**Animation:** CSS transition on `transform` + `opacity`. Adding a `.is-revealing` class on the overlay triggers `scale(0) → scale(1)` and `opacity 0 → 1` over `PORTRAIT_EXPAND_DURATION` ms. `transform-origin: center` (the hub). The method awaits a `setTimeout(duration)` and resolves.

### `toAvatarUrl` helper (`activity/src/lib/characterMedia.ts`)

Mirror of the existing `toMainBodyUrl`:

```ts
export function toAvatarUrl(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) return null;
  if (!VARIANT_PATTERN.test(mediaUrl)) return mediaUrl;
  return mediaUrl.replace(VARIANT_PATTERN, '-avatar.jpg$2');
}
```

### Timing (`activity/src/lib/timing.ts`)

Add one constant and bump one:

```ts
export const PORTRAIT_EXPAND_DURATION = 450;  // ms — new
export const POST_LAND_PAUSE = 700;            // was 400 — hold the big portrait tableau
```

No other timing constants change.

### PlayerChip refactor

Current chip is vertically structured (`chip-header` with role-dot + name on one row, `chip-tags` row below). New layout:

```
[portrait]  [name              ]
            [role-tag role-tag ]
```

- Portrait: ~34px circle with 2px class-color ring (using `getClassColor(characterClass)`), positioned at the left.
- Name + tags stack vertically to the right.
- Ready/not-ready checkmark stays in its current corner position.
- `sitting-out` / `not-ready` / `is-selected` states unchanged semantically.

The role-dot element is removed — the portrait ring carries class color, and the `role-tag` chips already convey the role info. This is a net reduction in visual clutter.

Fallback (no `mediaUrl`): same 34px circle, filled with a role-colored background + first initial in white. Uses the existing `role-dot` color palette (`--color-tank` / `--color-healer` / `--color-dps`) as a fallback ring when `characterClass` is null.

### IdentityView identity cards

Current card: horizontal row — `identity-card__avatar` is a 28px gold circle with a letter initial, `identity-card__name` beside it, optional claimed/selected markers at the right. The grid is `minmax(150px, 1fr)` auto-fill.

New behavior:
- When `player.mediaUrl` is set: render `<img>` inside `identity-card__avatar` (circular crop, class-color ring replaces gold fill).
- When null: keep the existing letter-initial + gold-fill fallback.
- Bump avatar size up (~28px → ~42px as a starting target — final value to be tuned in Storybook against Discord's small/medium/large viewports).
- Trim `identity-card` padding (currently `0.6rem 0.75rem`) slightly so the row stays compact despite the bigger avatar; grid `minmax` stays unchanged.
- All existing `identity-card--claimed` / `identity-card--selected` states and aria-labels preserved.

### CSS additions (`activity/src/index.css`)

Three new class families, roughly scoped as:

- `.wheel-portrait` — absolutely positioned inside `.wheel-frame`, `inset: 0`, flex-centered, `transform: scale(0)`, `opacity: 0`, `transition: transform … cubic-bezier, opacity … ease-out`. `.wheel-portrait.is-revealing` sets `transform: scale(1); opacity: 1`.
- `.wheel-portrait__img` — circular crop sized to the wheel radius (roughly `width: 80%; aspect-ratio: 1/1; border-radius: 50%; object-fit: cover`), class-color ring via `box-shadow` or `border`.
- `.wheel-portrait__fallback` — same dims, fills with class color, centered initial/`?` glyph.
- `.player-chip__portrait` / `.player-chip__body` — refactor of existing `.player-chip` to flex-row.
- `.identity-card__avatar` — adjusted sizing; supports `<img>` child with circular crop + ring.

Dark-mode / theme token usage matches existing patterns (`--ch-color`, `--color-tank` / `--color-healer` / `--color-dps`, `--bg-card`, etc.).

### Files touched

| File | Change |
|---|---|
| `activity/src/types.ts` | Extend `WheelEntry` with `mediaUrl`, `characterClass`. |
| `activity/src/lib/roles.ts` | `initPools` populates new `WheelEntry` fields. |
| `activity/src/lib/characterMedia.ts` | Add `toAvatarUrl` helper. |
| `activity/src/lib/timing.ts` | Add `PORTRAIT_EXPAND_DURATION`, bump `POST_LAND_PAUSE` to 700. |
| `activity/src/lib/wheel.ts` | Add portrait overlay, `revealPortrait()`, `clearPortrait()`, invoke in `spinTo`/`init`. |
| `activity/src/lib/wheelsGrid.ts` | No structural change — entry fields flow through. |
| `activity/src/components/PlayerChip.tsx` | Layout refactor + portrait; new props. |
| `activity/src/components/PlayerChip.stories.tsx` | Add stories for portrait / fallback / class-color variants. |
| `activity/src/views/LobbyView.tsx` | Pass `mediaUrl` + `characterClass` to `PlayerChip`. |
| `activity/src/views/IdentityView.tsx` | Portrait in identity-card avatar; size bump + padding trim. |
| `activity/src/views/IdentityView.stories.tsx` (new, if missing) | Stories: mixed mapped + unmapped + claimed states. |
| `activity/src/index.css` | New `.wheel-portrait*`, refactored `.player-chip*`, adjusted `.identity-card*`. |
| `activity/tests/__screenshots__/` | Regenerate visual snapshots (Docker). |

## Testing strategy

- **Storybook first.** Per the user's feedback memory, Storybook is the preview surface. Add/update stories for `PlayerChip` (portrait + letter-fallback + sitting-out/not-ready × portrait), `IdentityView` (mixed mapped/unmapped list with claims), and `Wheel` (static landing state with portrait visible).
- **Playwright snapshots (Docker).** After the code settles, run `./scripts/playwright-docker.sh --update-snapshots` and commit regenerated screenshots alongside the code. Views that snapshot `WheelsView` may need to freeze on the post-expand state (via a test-only mode or the existing `staticWheel` path) to avoid timing flake.
- **`./scripts/verify-activity.sh` must pass** (typecheck + build + Playwright) before commit.
- **No new unit tests required.** Wheel animation is visual; `toAvatarUrl` gets coverage analogous to any existing `toMainBodyUrl` tests if present — otherwise a tiny sibling test is worth adding.

## Rollout

- Single PR. No feature flag. The fallback path ensures the feature degrades cleanly for unmapped players, and existing weekly refresh + on-demand lookup already populate `mediaUrl` for the vast majority of cases.
- No bot or Firestore changes → no deploy coordination needed.

## Open risks

- **Wheel portrait reveal on small Discord viewports.** The `-avatar.jpg` head shot is ~84px native; on large grid-mode wheels (~200px+), we're upscaling a lossy JPEG. Should look OK at circle-crop sizes but worth eyeballing in Storybook before committing.
- **Canvas/DOM overlay z-index & stacking.** The portrait overlay must render above the canvas but below anything like the `wheel-pointer`. CSS layer is straightforward (append into the same `.wheel-frame`), but needs verification.
- **Playwright snapshot flake.** Animation adds a new time-dependent visual. Mitigation: snapshot either before the expand starts or at the settled end state; never mid-animation.
