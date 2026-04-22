# Character Portraits in PlayerChip, IdentityView, and Wheel Landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add round character portraits to the lobby's `PlayerChip`, to the `IdentityView` identity cards, and to the wheel landing (round avatar expands from hub to replace the canvas wheel after each spin).

**Architecture:** Extend `WheelEntry` with `mediaUrl` + `characterClass`. Add a DOM overlay inside each `Wheel`'s frame that animates in via CSS transitions after the existing gold-glow fade-in. Refactor `PlayerChip` to a leading-portrait + stacked-body layout. Swap `IdentityView`'s letter-initial avatar for a portrait (enlarged, class-color ring) with letter fallback. Portraits use the Blizzard `-avatar.jpg` head-shot variant via a new `toAvatarUrl` helper (mirror of `toMainBodyUrl`). All fallback paths preserved for players without a linked character.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Playwright (Docker), Zustand, Storybook, vanilla canvas for the wheel, CSS transitions for the portrait animation.

**Spec:** `docs/superpowers/specs/2026-04-21-character-portraits-in-lobby-identity-wheels-design.md`

**Branch:** `portraits-spec` (already exists and contains the spec commit). Implementation commits stack on top.

---

## Task 1: Add `toAvatarUrl` helper with tests

**Files:**
- Modify: `activity/src/lib/characterMedia.ts`
- Create: `activity/src/lib/characterMedia.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `activity/src/lib/characterMedia.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toAvatarUrl, toMainBodyUrl } from './characterMedia';

describe('toAvatarUrl', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(toAvatarUrl(null)).toBeNull();
    expect(toAvatarUrl(undefined)).toBeNull();
    expect(toAvatarUrl('')).toBeNull();
  });

  it('rewrites inset.jpg to avatar.jpg', () => {
    expect(toAvatarUrl('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg'))
      .toBe('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-avatar.jpg');
  });

  it('rewrites main-raw.png to avatar.jpg', () => {
    expect(toAvatarUrl('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-main-raw.png'))
      .toBe('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-avatar.jpg');
  });

  it('leaves already-avatar urls unchanged', () => {
    expect(toAvatarUrl('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-avatar.jpg'))
      .toBe('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-avatar.jpg');
  });

  it('preserves query strings', () => {
    expect(toAvatarUrl('https://example.com/184140522-inset.jpg?alt=v2'))
      .toBe('https://example.com/184140522-avatar.jpg?alt=v2');
  });

  it('passes through non-variant urls unchanged', () => {
    expect(toAvatarUrl('https://example.com/some-other-image.png'))
      .toBe('https://example.com/some-other-image.png');
  });
});

describe('toMainBodyUrl (regression guard)', () => {
  it('still rewrites avatar.jpg to main-raw.png', () => {
    expect(toMainBodyUrl('https://example.com/abc-avatar.jpg'))
      .toBe('https://example.com/abc-main-raw.png');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd activity && npx vitest run src/lib/characterMedia.test.ts`
Expected: FAIL — `toAvatarUrl is not a function` (it doesn't exist yet).

- [ ] **Step 3: Add `toAvatarUrl` to characterMedia.ts**

Edit `activity/src/lib/characterMedia.ts` — append after `toMainBodyUrl`:

```ts
export function toAvatarUrl(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) return null;
  if (!VARIANT_PATTERN.test(mediaUrl)) return mediaUrl;
  return mediaUrl.replace(VARIANT_PATTERN, '-avatar.jpg$2');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd activity && npx vitest run src/lib/characterMedia.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add activity/src/lib/characterMedia.ts activity/src/lib/characterMedia.test.ts
git commit -m "feat(activity): add toAvatarUrl helper for head-shot portrait variant"
```

---

## Task 2: Extend `WheelEntry` with portrait fields and update `initPools`

**Files:**
- Modify: `activity/src/types.ts:3-7`
- Modify: `activity/src/lib/roles.ts:179-193`
- Modify: `activity/src/lib/roles.test.ts` (add cases for new fields)

- [ ] **Step 1: Write failing tests for `initPools` populating new fields**

Append to `activity/src/lib/roles.test.ts` (add at the bottom of the file — first check the file structure with a quick read, then place these in the existing `describe('initPools', ...)` block if present, otherwise add a new one):

```ts
describe('initPools portrait fields', () => {
  it('carries mediaUrl and characterClass through to WheelEntry', () => {
    const players = [
      {
        name: 'Tank1',
        discordId: '1',
        mainRole: 'tank',
        offspecs: [],
        utilities: [],
        mediaUrl: 'https://example.com/abc-inset.jpg',
        characterClass: 'warrior',
      },
      {
        name: 'Healer1',
        discordId: '2',
        mainRole: 'healer',
        offspecs: [],
        utilities: [],
        mediaUrl: null,
        characterClass: null,
      },
    ] as const;

    const pools = initPools(players as never);
    expect(pools.tanks[0]).toMatchObject({
      name: 'Tank1',
      mediaUrl: 'https://example.com/abc-inset.jpg',
      characterClass: 'warrior',
    });
    expect(pools.healers[0]).toMatchObject({
      name: 'Healer1',
      mediaUrl: null,
      characterClass: null,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd activity && npx vitest run src/lib/roles.test.ts`
Expected: FAIL — `mediaUrl` / `characterClass` missing from `WheelEntry`.

- [ ] **Step 3: Extend `WheelEntry` type**

Edit `activity/src/types.ts`:

```ts
import type { WoWPlayerDict, WoWGroupDict, SessionStatus, CharacterClass } from '@mythicplus/shared';

export interface WheelEntry {
  name: string;
  isOffspec: boolean;
  isChosen?: boolean;
  mediaUrl: string | null;
  characterClass: CharacterClass | null;
}
```

- [ ] **Step 4: Update `initPools` to populate new fields**

Edit `activity/src/lib/roles.ts` — replace the body of `initPools`:

```ts
export function initPools(players: WoWPlayer[]): { tanks: WheelEntry[]; healers: WheelEntry[]; dps: WheelEntry[] } {
  const entry = (p: WoWPlayer, isOffspec: boolean): WheelEntry => ({
    name: p.name,
    isOffspec,
    mediaUrl: p.mediaUrl ?? null,
    characterClass: p.characterClass ?? null,
  });

  const tanks = players
    .filter((p) => p.mainRole === 'tank' || p.offspecs.includes('tank'))
    .map((p) => entry(p, p.mainRole !== 'tank'));

  const healers = players
    .filter((p) => p.mainRole === 'healer' || p.offspecs.includes('healer'))
    .map((p) => entry(p, p.mainRole !== 'healer'));

  const dps = players
    .filter((p) => p.mainRole === 'ranged' || p.mainRole === 'melee' || p.offspecs.includes('ranged') || p.offspecs.includes('melee'))
    .map((p) => entry(p, p.mainRole !== 'ranged' && p.mainRole !== 'melee'));

  return { tanks, healers, dps };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd activity && npx vitest run src/lib/roles.test.ts`
Expected: PASS for new tests. Other tests in this file should also still pass — if any break due to the expanded type, update their test fixtures to include `mediaUrl: null, characterClass: null`.

- [ ] **Step 6: Typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: no errors. If `mockData.ts` or other consumers break because they construct `WheelEntry` without the new fields, add `mediaUrl: null, characterClass: null` defaults inline at each failing call site.

- [ ] **Step 7: Commit**

```bash
git add activity/src/types.ts activity/src/lib/roles.ts activity/src/lib/roles.test.ts
git commit -m "feat(activity): extend WheelEntry with mediaUrl and characterClass"
```

---

## Task 3: Add timing constants for portrait reveal

**Files:**
- Modify: `activity/src/lib/timing.ts`

- [ ] **Step 1: Add new constant and bump `POST_LAND_PAUSE`**

Edit `activity/src/lib/timing.ts` — replace lines 1–12:

```ts
// ── Configurable Timing Constants ────────────────────────────
export const CAROUSEL_SPIN_DURATION = 2000;   // ms per wheel in carousel mode
export const CAROUSEL_ADVANCE_DELAY = 400;    // ms pause after each landing
export const GRID_SPIN_DURATION = 4000;       // ms per wheel in grid mode

// Portrait reveal timing (plays after gold-glow fade-in, before wheel fades out)
export const PORTRAIT_EXPAND_DURATION = 450;  // ms for portrait scale-in animation

// Auto-advance spotlight timing
export const SPOTLIGHT_HOLD_DURATION = 1500;  // ms to hold spotlight card center-stage
export const SPOTLIGHT_ENTER_DURATION = 500;  // ms for spotlight card enter animation
export const SPOTLIGHT_EXIT_DURATION = 400;   // ms for spotlight card exit animation
export const WHEELS_FADE_DURATION = 350;      // ms for wheels fade in/out
export const POST_LAND_PAUSE = 700;           // ms pause after wheels land (holds portrait tableau)
export const PROGRESS_FADE_DURATION = 200;    // ms for progress text cross-fade
```

- [ ] **Step 2: Typecheck**

Run: `cd activity && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add activity/src/lib/timing.ts
git commit -m "feat(activity): add PORTRAIT_EXPAND_DURATION, bump POST_LAND_PAUSE to 700"
```

---

## Task 4: Add CSS for wheel portrait overlay

**Files:**
- Modify: `activity/src/index.css`

- [ ] **Step 1: Append new CSS block**

Find the section in `activity/src/index.css` where wheel-related styles live (search for `.wheel-frame` or `.wheel-slot`). Immediately after the `.wheel-frame` rule(s), append:

```css
/* ============================================
   Wheel portrait reveal (post-land animation)
   ============================================ */
.wheel-portrait {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transform: scale(0);
  opacity: 0;
  transition:
    transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 300ms ease-out;
  z-index: 3;
}

.wheel-portrait.is-revealing {
  transform: scale(1);
  opacity: 1;
}

.wheel-portrait__img,
.wheel-portrait__fallback {
  width: 80%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: 4px solid var(--wp-color, var(--color-gold));
  box-shadow:
    0 0 24px color-mix(in srgb, var(--wp-color, var(--color-gold)) 40%, transparent),
    0 8px 24px rgba(0, 0, 0, 0.55);
  background: #0d0d1a;
}

.wheel-portrait__img {
  object-fit: cover;
}

.wheel-portrait__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', sans-serif;
  font-weight: 800;
  font-size: clamp(32px, 18%, 80px);
  color: var(--wp-color, #fff);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  background: color-mix(in srgb, var(--wp-color, var(--color-gold)) 22%, #0d0d1a);
}
```

**Note:** The `.wheel-frame` element must have `position: relative` so the overlay's absolute positioning works. Grep and confirm:

Run: `grep -n "\.wheel-frame" activity/src/index.css`

If `.wheel-frame` does not set `position: relative`, add it to the existing rule (do not create a duplicate rule).

- [ ] **Step 2: Sanity-check CSS by running the build**

Run: `cd activity && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add activity/src/index.css
git commit -m "feat(activity): CSS for wheel portrait overlay"
```

---

## Task 5: Add portrait overlay DOM + clearPortrait to `Wheel`

**Files:**
- Modify: `activity/src/lib/wheel.ts`

- [ ] **Step 1: Add imports and helper state**

At the top of `activity/src/lib/wheel.ts`, add imports:

```ts
import { WheelEntry } from '../types';
import { audio } from './audio';
import { toAvatarUrl } from './characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from './classColors';
```

- [ ] **Step 2: Add portrait fields on the class**

Inside the `Wheel` class (just after the existing private fields, around line 67), add:

```ts
  private portraitEl: HTMLDivElement;
  private portraitImg: HTMLImageElement;
  private portraitFallback: HTMLDivElement;
```

- [ ] **Step 3: Build portrait DOM in the constructor**

In the `Wheel` constructor, after the `frame` is created and the canvas is appended (but before `this.slotEl.appendChild(frame)`), append the portrait overlay to the frame:

```ts
    this.portraitEl = document.createElement('div');
    this.portraitEl.className = 'wheel-portrait';
    this.portraitEl.setAttribute('aria-hidden', 'true');

    this.portraitImg = document.createElement('img');
    this.portraitImg.className = 'wheel-portrait__img';
    this.portraitImg.alt = '';
    this.portraitImg.style.display = 'none';
    this.portraitEl.appendChild(this.portraitImg);

    this.portraitFallback = document.createElement('div');
    this.portraitFallback.className = 'wheel-portrait__fallback';
    this.portraitFallback.style.display = 'none';
    this.portraitEl.appendChild(this.portraitFallback);

    // If <img> fails to load, swap to fallback
    this.portraitImg.addEventListener('error', () => {
      this.portraitImg.style.display = 'none';
      this.portraitFallback.style.display = 'flex';
    });

    frame.appendChild(this.portraitEl);
```

- [ ] **Step 4: Add `clearPortrait` method**

At the bottom of the `Wheel` class (before the closing brace), add:

```ts
  /** Hide the portrait overlay and reset it for the next spin. */
  clearPortrait() {
    this.portraitEl.classList.remove('is-revealing');
    this.portraitImg.style.display = 'none';
    this.portraitImg.removeAttribute('src');
    this.portraitFallback.style.display = 'none';
    this.portraitFallback.textContent = '';
    this.portraitEl.style.removeProperty('--wp-color');
  }
```

- [ ] **Step 5: Call `clearPortrait` at the top of `init`**

In `init(entries: WheelEntry[])` (around line 126), add `this.clearPortrait();` as the first line of the method body.

- [ ] **Step 6: Typecheck**

Run: `cd activity && npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add activity/src/lib/wheel.ts
git commit -m "feat(activity): add portrait overlay DOM + clearPortrait to Wheel"
```

---

## Task 6: Implement `Wheel.revealPortrait`

**Files:**
- Modify: `activity/src/lib/wheel.ts`

- [ ] **Step 1: Add `revealPortrait` method**

Inside the `Wheel` class, below `clearPortrait`, add:

```ts
  /**
   * Animate the winner's portrait in from the center of the wheel.
   * Called from spinTo after the gold-glow highlight fade-in completes.
   * Resolves after the expand animation duration.
   */
  revealPortrait(winnerEntry: WheelEntry, duration: number): Promise<void> {
    const color = getClassColor(winnerEntry.characterClass) ?? '#f59e0b';
    this.portraitEl.style.setProperty('--wp-color', color);

    const avatarUrl = toAvatarUrl(winnerEntry.mediaUrl);
    const proxied = remapImageUrl(avatarUrl ?? undefined);

    if (proxied) {
      this.portraitImg.src = proxied;
      this.portraitImg.style.display = 'block';
      this.portraitFallback.style.display = 'none';
    } else {
      this.portraitImg.style.display = 'none';
      this.portraitFallback.textContent = winnerEntry.name.charAt(0).toUpperCase() || '?';
      this.portraitFallback.style.display = 'flex';
    }

    // Force a reflow so the transition kicks in even if the class was
    // removed and re-added in the same tick (next group's spin).
    void this.portraitEl.offsetWidth;
    this.portraitEl.classList.add('is-revealing');

    return new Promise((resolve) => {
      setTimeout(resolve, duration);
    });
  }
```

- [ ] **Step 2: Typecheck**

Run: `cd activity && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add activity/src/lib/wheel.ts
git commit -m "feat(activity): implement revealPortrait on Wheel with fallback"
```

---

## Task 7: Invoke `revealPortrait` inside `spinTo`

**Files:**
- Modify: `activity/src/lib/wheel.ts`

- [ ] **Step 1: Pipe portrait reveal into the spin sequence**

In `spinTo`, find the inner `fadeIn` function (around lines 446–462). Currently it resolves with the winner name after the fade-in finishes. Replace its `else` branch (the block that runs when `p >= 1`) with:

```ts
            } else {
              this.animationFrame = null;
              this.rejectSpin = null;
              this.resultEl.textContent = winnerName;
              this.resultEl.classList.add('revealed');
              this.canvas.setAttribute('aria-label', `${this.baseLabel}. Result: ${winnerName}`);

              const winnerEntry = this.entries[winnerIndex];
              // Import PORTRAIT_EXPAND_DURATION at top of file (see Step 2)
              this.revealPortrait(winnerEntry, PORTRAIT_EXPAND_DURATION).then(() => {
                resolve(winnerName);
              });
            }
```

- [ ] **Step 2: Add the timing import at top of file**

Add to the imports at the top of `activity/src/lib/wheel.ts`:

```ts
import { PORTRAIT_EXPAND_DURATION } from './timing';
```

- [ ] **Step 3: Handle cancel correctly**

The existing `cancel()` method (around line 369) cancels animations but does not clear the portrait. Update it:

```ts
  cancel() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.highlightIndex = null;
    this.highlightProgress = 0;
    this.clearPortrait();
    if (this.rejectSpin) {
      this.rejectSpin('cancelled');
      this.rejectSpin = null;
    }
  }
```

- [ ] **Step 4: Typecheck + build**

Run: `cd activity && npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 5: Manual preview in Storybook (visual check)**

Run: `cd activity && npm run storybook` (in a separate terminal) — skip if running headlessly; otherwise navigate to any story that mounts `WheelsView` (e.g. `WheelsView.stories.tsx`) and verify the portrait expands after each wheel lands.

If Storybook cannot be run in this environment, continue — `verify-activity.sh` later will catch regressions.

- [ ] **Step 6: Commit**

```bash
git add activity/src/lib/wheel.ts
git commit -m "feat(activity): expand winner portrait from wheel hub after landing"
```

---

## Task 8: Refactor `PlayerChip` to leading-portrait layout (P2)

**Files:**
- Modify: `activity/src/components/PlayerChip.tsx`
- Modify: `activity/src/index.css` (the existing `.player-chip` rules)

- [ ] **Step 1: Update `PlayerChip` component**

Replace the full contents of `activity/src/components/PlayerChip.tsx` with:

```tsx
import type { CharacterClass } from '@mythicplus/shared';
import { type RoleTag, getRoleColor } from '../lib/roles';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';

const ReadyIcon = () => (
  <svg className="ready-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const NotReadyIcon = () => (
  <svg className="not-ready-x" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export interface PlayerChipProps {
  /** Player display name. */
  name: string;
  /** Role key: 'tank' | 'healer' | 'ranged' | 'melee' | 'unassigned'. */
  roleKey: string;
  /** Human label for the role (used as aria/title). */
  roleLabel: string;
  /** Tags shown under the name (offspecs, utilities). */
  tags?: RoleTag[];
  /** Player is currently selected in the UI. */
  isSelected?: boolean;
  /** Player is sitting out this round. */
  isSittingOut?: boolean;
  /** Player is ready to spin (has role + WoW name). */
  isReady?: boolean;
  /** Character portrait media URL (any Blizzard variant). */
  mediaUrl?: string | null;
  /** Character class — drives portrait ring color. */
  characterClass?: CharacterClass | null;
  /** Click handler — fired from click or Enter/Space. */
  onClick?: () => void;
  /** Accessible label for the chip. Defaults to "Edit {name} roles". */
  ariaLabel?: string;
}

function ChipPortrait({ name, roleKey, mediaUrl, characterClass }: {
  name: string;
  roleKey: string;
  mediaUrl?: string | null;
  characterClass?: CharacterClass | null;
}) {
  const ringColor = getClassColor(characterClass) ?? getRoleColor(roleKey);
  const avatarUrl = toAvatarUrl(mediaUrl);
  const proxied = remapImageUrl(avatarUrl ?? undefined);

  return (
    <div
      className="player-chip__portrait"
      style={{ '--pc-ring': ringColor } as React.CSSProperties}
      aria-hidden="true"
    >
      {proxied ? (
        <img
          src={proxied}
          alt=""
          className="player-chip__portrait-img"
          onError={(e) => {
            // Hide broken image; fallback letter is always in the DOM behind it.
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span className="player-chip__portrait-letter">{name.charAt(0).toUpperCase() || '?'}</span>
      )}
    </div>
  );
}

export function PlayerChip({
  name,
  roleKey,
  roleLabel,
  tags = [],
  isSelected = false,
  isSittingOut = false,
  isReady = false,
  mediaUrl,
  characterClass,
  onClick,
  ariaLabel,
}: PlayerChipProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`player-chip${isSelected ? ' is-selected' : ''}${isSittingOut ? ' sitting-out' : ''}${!isReady && !isSittingOut ? ' not-ready' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? `Edit ${name} roles`}
      title={roleLabel}
    >
      {isReady && <ReadyIcon />}
      {!isReady && !isSittingOut && <NotReadyIcon />}
      <ChipPortrait
        name={name}
        roleKey={roleKey}
        mediaUrl={mediaUrl}
        characterClass={characterClass}
      />
      <div className="player-chip__body">
        <span className="player-chip__name">{name}</span>
        {tags.length > 0 && (
          <div className="chip-tags">
            {tags.map((tag, i) => (
              <span key={i} className={`role-tag ${tag.cssClass}`}>
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `.player-chip` CSS**

Find the existing `.player-chip`, `.chip-header`, and related rules in `activity/src/index.css`. Replace the `.player-chip` layout with the new flex-row structure. Specifically:

1. Locate the existing `.player-chip` rule and its children (`.chip-header`, etc.) — they need to be edited in place.
2. Replace the chip layout section with:

```css
.player-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s, background 0.15s;
}

.player-chip:hover {
  border-color: var(--color-gold);
  background: var(--bg-card-hover);
}

.player-chip.is-selected {
  border-color: var(--color-gold);
  background: rgba(245, 158, 11, 0.08);
}

.player-chip.sitting-out {
  opacity: 0.55;
}

.player-chip.not-ready {
  border-color: color-mix(in srgb, var(--color-red, #ef4444) 50%, var(--border-subtle));
}

.player-chip__portrait {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  border: 2px solid var(--pc-ring, var(--color-gold));
  background: color-mix(in srgb, var(--pc-ring, var(--color-gold)) 18%, #0d0d1a);
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-chip__portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.player-chip__portrait-letter {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.player-chip__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.player-chip__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Keep existing .chip-tags rule. Delete the now-unused .chip-header rule
   (if it exists) to reduce CSS dead weight. */
```

**Before editing**: grep for `chip-header` usage to ensure no other component references it:

Run: `grep -rn "chip-header" activity/src --include="*.tsx" --include="*.ts"`

If no remaining references exist, delete the `.chip-header` rule and any related rules (`.role-dot` usage inside `.chip-header` is now orphaned — delete those nested rules too). Keep `.role-dot` standalone rules (they're used elsewhere, e.g. the legend). If `role-dot` turns out to be unused entirely, delete it — but verify first with grep.

- [ ] **Step 3: Typecheck + build**

Run: `cd activity && npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add activity/src/components/PlayerChip.tsx activity/src/index.css
git commit -m "feat(activity): redesign PlayerChip with leading character portrait"
```

---

## Task 9: Wire `mediaUrl` + `characterClass` through `LobbyView` to `PlayerChip`

**Files:**
- Modify: `activity/src/views/LobbyView.tsx:108-127`

- [ ] **Step 1: Pass new props at the PlayerChip call site**

In `activity/src/views/LobbyView.tsx`, update `renderChip`:

```tsx
  const renderChip = (p: typeof players[number]) => {
    const roleKey = getPrimaryRole(p);
    const isSelected = activePlayer != null && p.discordId === activePlayer.discordId;
    const isSittingOut = p.discordId != null && sittingOut.includes(p.discordId);
    const isSelf = p.discordId === currentPlayerId;
    return (
      <PlayerChip
        key={p.discordId || p.name}
        name={p.name}
        roleKey={roleKey}
        roleLabel={formatRoleName(roleKey)}
        tags={getRoleTags(p)}
        isSelected={isSelected}
        isSittingOut={isSittingOut}
        isReady={isPlayerReady(p)}
        mediaUrl={p.mediaUrl}
        characterClass={p.characterClass}
        onClick={() => handleChipClick(p)}
        ariaLabel={isSelf ? `View ${p.name} details` : `Edit ${p.name} roles`}
      />
    );
  };
```

- [ ] **Step 2: Typecheck**

Run: `cd activity && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add activity/src/views/LobbyView.tsx
git commit -m "feat(activity): pass mediaUrl + characterClass from LobbyView to PlayerChip"
```

---

## Task 10: Update `PlayerChip` stories

**Files:**
- Modify: `activity/src/components/PlayerChip.stories.tsx`

- [ ] **Step 1: Read existing stories file**

Run: `cat activity/src/components/PlayerChip.stories.tsx` — keep the existing story structure. Add new stories, do not delete existing ones unless their arg shape is broken by the new required props (none are required, so existing stories still work).

- [ ] **Step 2: Append new stories**

Append to `activity/src/components/PlayerChip.stories.tsx` (after the last existing `Story` export):

```tsx
export const WithPortrait: Story = {
  args: {
    name: 'Tytanium',
    roleKey: 'ranged',
    roleLabel: 'Ranged DPS',
    tags: [{ label: 'Lust', cssClass: 'lust' }],
    isReady: true,
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg',
    characterClass: 'mage',
  },
};

export const WithPortraitSittingOut: Story = {
  args: {
    name: 'Tytanium',
    roleKey: 'ranged',
    roleLabel: 'Ranged DPS',
    tags: [],
    isSittingOut: true,
    mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg',
    characterClass: 'mage',
  },
};

export const PortraitFallbackLetter: Story = {
  args: {
    name: 'NewPlayer',
    roleKey: 'tank',
    roleLabel: 'Tank',
    tags: [],
    isReady: false,
    mediaUrl: null,
    characterClass: null,
  },
};

export const BrokenImageFallback: Story = {
  args: {
    name: 'BrokenTank',
    roleKey: 'tank',
    roleLabel: 'Tank',
    tags: [{ label: 'Heal Offspec', cssClass: 'healer' }],
    isReady: true,
    mediaUrl: 'https://example.invalid/broken-inset.jpg',
    characterClass: 'warrior',
  },
};
```

- [ ] **Step 3: Typecheck + build**

Run: `cd activity && npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add activity/src/components/PlayerChip.stories.tsx
git commit -m "docs(activity): PlayerChip stories for portrait + fallback states"
```

---

## Task 11: Portrait in `IdentityView` identity cards (I2)

**Files:**
- Modify: `activity/src/views/IdentityView.tsx:60-85`
- Modify: `activity/src/index.css` (`.identity-card__avatar` block, lines ~2473–2484)

- [ ] **Step 1: Update `IdentityView` render**

In `activity/src/views/IdentityView.tsx`, add imports at the top:

```tsx
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';
```

Replace the `{players.map(...)}` block (currently lines ~65–84) with:

```tsx
              {players.map((player) => {
                const id = player.discordId ?? player.name;
                const isClaimed = player.discordId != null && claimedPlayers.includes(player.discordId);
                const isSelected = player.discordId === selectedId;
                const avatarUrl = remapImageUrl(toAvatarUrl(player.mediaUrl) ?? undefined);
                const ringColor = getClassColor(player.characterClass) ?? 'var(--color-gold)';
                return (
                  <button
                    key={id}
                    className={`identity-card${isSelected ? ' identity-card--selected' : ''}${isClaimed ? ' identity-card--claimed' : ''}`}
                    onClick={() => handleSelect(player)}
                    aria-label={isClaimed ? `${player.name} (claimed)` : `Select ${player.name}`}
                  >
                    <div
                      className="identity-card__avatar"
                      style={{ '--ic-ring': ringColor } as React.CSSProperties}
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="identity-card__avatar-img"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <span className="identity-card__avatar-letter">
                          {player.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="identity-card__name">{player.name}</span>
                    {isSelected && <span className="identity-card__check">{'✓'}</span>}
                    {isClaimed && <span className="identity-card__claimed">Claimed</span>}
                  </button>
                );
              })}
```

- [ ] **Step 2: Update CSS for `.identity-card__avatar`**

Edit `activity/src/index.css` — replace the existing `.identity-card__avatar` rule (around lines 2473–2484) with:

```css
.identity-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color 0.15s, background 0.15s;
}

.identity-card__avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 2px solid var(--ic-ring, var(--color-gold));
  background: color-mix(in srgb, var(--ic-ring, var(--color-gold)) 22%, #0d0d1a);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.identity-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.identity-card__avatar-letter {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
```

**Note:** This fully replaces the old rule. Remove the old `.identity-card__avatar` rule entirely. The `.identity-card` rule block is also replaced (padding trimmed from `0.6rem 0.75rem` to `0.45rem 0.6rem` to offset the bigger avatar).

- [ ] **Step 3: Typecheck + build**

Run: `cd activity && npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add activity/src/views/IdentityView.tsx activity/src/index.css
git commit -m "feat(activity): character portraits on IdentityView identity cards"
```

---

## Task 12: Add `IdentityView` Storybook stories

**Files:**
- Create: `activity/src/views/IdentityView.stories.tsx` (if missing)

- [ ] **Step 1: Check if story file exists**

Run: `ls activity/src/views/IdentityView.stories.tsx 2>&1`

If it exists, read it first and append stories there instead. Otherwise, create it.

- [ ] **Step 2: Read an existing view story to match patterns**

Run: `cat activity/src/views/ChannelsView.stories.tsx`

Observe how the existing view stories wire up the store via `withStore` decorator and supply `onNavigate` no-op.

- [ ] **Step 3: Create `IdentityView.stories.tsx`**

Create `activity/src/views/IdentityView.stories.tsx` with three stories that mirror `ChannelsView.stories.tsx`'s decorator/store-injection pattern. The key arg is `channelData.players` with mixed `mediaUrl` values. Stories to include:

- `AllMapped` — every player has `mediaUrl` + `characterClass`
- `MixedMapping` — some players have portraits, others use letter fallback
- `WithClaimed` — includes one player marked as claimed (already in `claimedPlayers`)

Implementation details:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { IdentityView } from './IdentityView';
import type { WoWPlayer } from '../types';

const mkPlayer = (i: number, overrides: Partial<WoWPlayer> = {}): WoWPlayer => ({
  name: `Player${i}`,
  discordId: `${100000000000000000 + i}`,
  mainRole: null,
  offspecs: [],
  utilities: [],
  mediaUrl: null,
  characterClass: null,
  ...overrides,
});

const mappedMage = mkPlayer(1, {
  name: 'Tytanium',
  inGameName: 'Tytaniormu-Uldum',
  mainRole: 'ranged',
  mediaUrl: 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg',
  characterClass: 'mage',
});

const mappedPaladin = mkPlayer(2, {
  name: 'Martz',
  mainRole: 'healer',
  mediaUrl: 'https://render.worldofwarcraft.com/us/character/tichondrius/84/99999984-inset.jpg',
  characterClass: 'paladin',
});

const mappedWarrior = mkPlayer(3, {
  name: 'Pandemonium',
  mainRole: 'tank',
  mediaUrl: 'https://render.worldofwarcraft.com/us/character/bleedinghollow/99/99999999-inset.jpg',
  characterClass: 'warrior',
});

const unmappedA = mkPlayer(4, { name: 'NewPlayer' });
const unmappedB = mkPlayer(5, { name: 'GuestDPS' });

const storeWith = (players: WoWPlayer[], claimed: string[] = []) => ({
  currentGuildId: 'demo-guild',
  currentChannelId: 'vc-1',
  channelData: {
    channelId: 'vc-1',
    channelName: 'Mythic Plus',
    guildId: 'demo-guild',
    status: 'lobby' as const,
    players,
    groups: [],
    claimedPlayers: claimed,
    sittingOut: [],
    isDebug: false,
    createdAt: Date.now(),
    lastActive: Date.now(),
  },
});

const meta = {
  title: 'Views/IdentityView',
  component: IdentityView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof IdentityView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllMapped: Story = {
  args: { onNavigate: () => undefined },
  decorators: [withStore(storeWith([mappedMage, mappedPaladin, mappedWarrior]))],
};

export const MixedMapping: Story = {
  args: { onNavigate: () => undefined },
  decorators: [withStore(storeWith([mappedMage, unmappedA, mappedPaladin, unmappedB, mappedWarrior]))],
};

export const WithClaimed: Story = {
  args: { onNavigate: () => undefined },
  decorators: [withStore(storeWith([mappedMage, mappedPaladin, mappedWarrior], [mappedPaladin.discordId!]))],
};
```

If the `withStore` decorator signature differs from what `ChannelsView.stories.tsx` uses, mirror that file's exact pattern instead of the above — the surface shape is the same.

- [ ] **Step 4: Typecheck + build**

Run: `cd activity && npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add activity/src/views/IdentityView.stories.tsx
git commit -m "docs(activity): IdentityView stories for portrait + fallback states"
```

---

## Task 13: Update Playwright visual snapshots

**Files:**
- Modify: `activity/tests/__screenshots__/**/*.png`

- [ ] **Step 1: Identify affected tests**

The changes affect three UI surfaces. Most Playwright tests that render `LobbyView`, `IdentityView`, or `WheelsView` will have visual diffs. List affected tests:

Run: `grep -lrn "PlayerChip\|IdentityView\|WheelsView\|lobby\|identity\|wheels" activity/tests/ | head -20`

- [ ] **Step 2: Regenerate snapshots in Docker**

Run: `./scripts/playwright-docker.sh --update-snapshots`
Expected: Docker container runs, tests pass with regenerated screenshots.

If tests fail for reasons unrelated to visuals (e.g. animation timing, layout overflow), pause here and investigate. Common fixes:
- Wheel expand animation creates visible diff mid-animation → gate the test on a `staticWheel` rendering path or await a settled state (`page.waitForFunction`).
- New CSS breaks an unrelated layout → trace the selector collision with devtools and adjust CSS specificity.

- [ ] **Step 3: Review the regenerated snapshots**

Run: `git status` — confirm only `activity/tests/__screenshots__/**/*.png` files changed, no unexpected diffs.

Visually inspect a handful:
- Open a couple of diffs in a viewer (`ls activity/tests/__screenshots__/` then `open <path>` if on macOS) to confirm the new renderings look correct — portraits present where expected, layouts not broken.

- [ ] **Step 4: Run full activity verification**

Run: `./scripts/verify-activity.sh`
Expected: typecheck + build + Playwright (Docker) all pass.

- [ ] **Step 5: Commit**

```bash
git add activity/tests/__screenshots__
git commit -m "test(activity): update visual snapshots for portrait additions"
```

---

## Task 14: Final verification + PR

**Files:** none (verification and PR)

- [ ] **Step 1: Run full backend verification**

Backend code wasn't touched, but CI runs backend checks on every PR. Quick sanity:

Run: `./scripts/verify-ts.sh`
Expected: lint + typecheck + backend tests all pass. (They should — nothing backend changed.)

- [ ] **Step 2: Run full activity verification**

Run: `./scripts/verify-activity.sh`
Expected: typecheck + build + Playwright (Docker) all pass.

- [ ] **Step 3: Review full diff**

Run: `git log --oneline main..HEAD` — confirm commits read cleanly in order.
Run: `git diff main..HEAD --stat` — confirm only the expected files are touched.

- [ ] **Step 4: Push and open PR via `/ship-it`**

Per `CLAUDE.md` ("When asked to ship/deploy/push changes, use the `/ship-it` skill to create a PR — do not push to main directly"), stop here and hand back to the user with a summary:

> Implementation complete on branch `portraits-spec`. Ready for `/ship-it` to open the PR.

Do not push or open the PR directly.

---

## Notes for executor

- **Existing test fixtures may break when `WheelEntry` gains required fields.** When this happens, add `mediaUrl: null, characterClass: null` at the call site — do not relax the type.
- **Animation timing flake in Playwright:** If the Wheel expand animation causes a snapshot to be unstable, the simplest fix is to freeze the test viewport on the *settled* post-expand state (not mid-animation). If that requires a test-only flag or a `waitForFunction` probe, add it narrowly rather than disabling the animation globally.
- **Discord activity proxy:** Portrait URLs MUST go through `remapImageUrl` or they won't load inside Discord. Never render a raw `render.worldofwarcraft.com` URL into an `<img src>` in this codebase.
- **`characterClass` type:** `CharacterClass` is imported from `@mythicplus/shared` (see `packages/shared/src/types.ts:22`). Use `getClassColor(characterClass)` from `activity/src/lib/classColors.ts` — it accepts `null | undefined` and returns `null` for unknown classes.
- **No bot/Firestore changes.** The bot already stores `mediaUrl` and `characterClass` on every player. No migration needed.
