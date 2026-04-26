# Results Carousel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicate "spotlight portraits + bottom group cards" rendering on the `/activity` results view with a single `GroupSlide` / `GroupCarousel` pair that fits the affixes, the carousel, the Suggested Keys panel, and the New Round button on screen without scrolling.

**Architecture:** Two new presentational/container components in `activity/src/components/`. `GroupSlide` renders one `WoWGroup` as a 5-column grid (role icons row → utility icons row → portraits → names → Copy Invite). `GroupCarousel` wraps a list of slides, owns active-index state with prev/next navigation (arrow buttons, keyboard, click-on-side-peek, touch swipe), and renders adjacent slides faded/scaled-down. `ResultsView` lifts `activeSlideIndex` so it can re-scope `useDungeonSuggestions` to the active group; the `DungeonSuggestions` panel cross-fades when the active slide changes.

**Tech Stack:** React + TypeScript + CSS in `activity/src/index.css`. Vitest for unit tests. Storybook stories for component fixtures. Playwright (Docker) for visual regression.

**Spec:** `docs/superpowers/specs/2026-04-25-results-carousel-redesign-design.md`

---

## File Structure

**Created**

- `activity/src/components/GroupSlide.tsx` — single-group presentational slide. Pure render of a group with role/util/portrait/name rows + Copy Invite.
- `activity/src/components/GroupSlide.stories.tsx` — story fixtures (complete group, remainder, off-spec marker, no-invite).
- `activity/src/components/GroupCarousel.tsx` — controlled carousel with active-index, arrows, keyboard, touch, click-on-peek.
- `activity/src/components/GroupCarousel.stories.tsx` — story fixtures (multi-group + remainder, single, viewer-centered).
- `activity/tests/group-carousel.test.ts` — vitest test for carousel navigation logic.

**Modified**

- `activity/src/views/ResultsView.tsx` — replace `SpotlightPortraits` + `final-groups` with `<GroupCarousel>`; lift `activeSlideIndex`; per-slide suggestion scoping; remainder empty state.
- `activity/src/views/ResultsView.stories.tsx` — refresh fixtures for the new layout (no functional change in story decorators; the visual snapshots regenerate).
- `activity/src/index.css` — add carousel/slide styles, tighten affixes-bar padding for vertical density. Existing styles for the components no longer used by `ResultsView` stay (other consumers).

**Untouched**

- `activity/src/components/SpotlightPortrait.tsx` — reused inside `GroupSlide`.
- `activity/src/components/SpotlightPortraits.tsx` — still used by `SpotlightCard`.
- `activity/src/components/MobileGroupPager.tsx`, `GroupCard.tsx` — still used by `WheelsView`.
- `activity/src/hooks/useDungeonSuggestions.ts` — no semantic changes.

---

## Verification Commands (reference)

Use these throughout the plan as instructed. Run from project root unless stated.

- Frontend type + build: `./scripts/verify-activity.sh`
- Frontend tests only (vitest, in `activity/`): `cd activity && npm run test`
- Frontend dev server (manual smoke): `cd activity && npm run dev`
- Playwright snapshot regen (Docker): `./scripts/playwright-docker.sh --update-snapshots`
- Playwright run (Docker): `./scripts/playwright-docker.sh`

---

## Task 1: Scaffold `GroupSlide` (heading + 5-column grid skeleton)

**Files:**
- Create: `activity/src/components/GroupSlide.tsx`
- Create: `activity/src/components/GroupSlide.stories.tsx`
- Modify: `activity/src/index.css` (append styles at end)

This task lays down the empty 5-column scaffold and the heading, with a story rendering it. Subsequent tasks fill the rows.

- [ ] **Step 1: Create the `GroupSlide` component skeleton**

Create `activity/src/components/GroupSlide.tsx`:

```tsx
import type { WoWGroup } from '../types';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';

export interface GroupSlideProps {
  group: WoWGroup;
  index: number;
  label?: string;
  scoresByDiscordId?: ReadonlyMap<string, CharacterDungeonScores | null>;
}

const SLOT_COUNT = 5;

type SlotRole = 'tank' | 'healer' | 'dps';

interface Slot {
  role: SlotRole;
  // null when the group has no player in this slot (remainder case).
  player: WoWGroup['tank'];
}

function buildSlots(group: WoWGroup): Slot[] {
  const slots: Slot[] = [
    { role: 'tank', player: group.tank },
    { role: 'healer', player: group.healer },
  ];
  for (let i = 0; i < 3; i++) {
    slots.push({ role: 'dps', player: group.dps[i] ?? null });
  }
  return slots.slice(0, SLOT_COUNT);
}

export function GroupSlide({ group, index, label }: GroupSlideProps) {
  const heading = label ?? `Group ${index + 1}`;
  const slots = buildSlots(group);

  return (
    <div className="group-slide" data-testid={`group-slide-${index}`}>
      <h3 className="group-slide__heading">{heading}</h3>
      <div className="group-slide__grid" role="group" aria-label={heading}>
        {slots.map((slot, i) => (
          <div className="group-slide__col" key={i} data-role={slot.role}>
            {/* role-icon, utility-icon, portrait, name rows fill in later tasks */}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add minimal CSS for the slide grid**

Append to `activity/src/index.css`:

```css
/* ============================================
   GroupSlide
   ============================================ */
.group-slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

.group-slide__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary, var(--text-primary));
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.group-slide__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  column-gap: clamp(8px, 1.5vw, 20px);
  row-gap: 6px;
  width: 100%;
  align-items: end;
  justify-items: center;
}

.group-slide__col {
  display: contents;
}
```

Note: `display: contents` lets each `.group-slide__col` flatten into the grid so per-row alignment works. Each row of content (role icon, utility icon, portrait, name) is placed individually inside the column wrapper in subsequent tasks.

> Strike `display: contents` and switch to per-cell wrappers later if alignment fights row-gap. For now this is intentionally simple.

- [ ] **Step 3: Add the Storybook story**

Create `activity/src/components/GroupSlide.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { showcaseGroups, SHOWCASE_CURRENT_PLAYER_ID } from '../lib/showcaseFixtures';
import { GroupSlide } from './GroupSlide';

const meta = {
  title: 'Organisms/GroupSlide',
  component: GroupSlide,
  parameters: { layout: 'centered' },
  decorators: [withStore({ currentPlayerId: SHOWCASE_CURRENT_PLAYER_ID })],
} satisfies Meta<typeof GroupSlide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullGroup: Story = {
  args: { group: showcaseGroups[0], index: 0 },
};

export const Remainder: Story = {
  args: { group: showcaseGroups[2], index: 2, label: 'Remainder' },
};
```

- [ ] **Step 4: Verify it renders**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass. (Stories render to empty columns at this stage; the Playwright snapshot is updated at the end of the plan.)

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/GroupSlide.tsx activity/src/components/GroupSlide.stories.tsx activity/src/index.css
git commit -m "feat(activity): scaffold GroupSlide component"
```

---

## Task 2: `GroupSlide` — role icon row

**Files:**
- Modify: `activity/src/components/GroupSlide.tsx`
- Modify: `activity/src/index.css`

Render a circular role icon at the top of each column, using existing `--color-tank` / `--color-healer` / `--color-dps` tokens. Off-spec slots get a hollow ring matching the existing `.role-indicator.offspec` styling pattern.

- [ ] **Step 1: Add the role icon row to the slide**

In `activity/src/components/GroupSlide.tsx`, replace the empty column body with a role icon. Import the existing role-color helpers and add an `isOffspec` derivation:

```tsx
import type { WoWGroup, WoWPlayer } from '../types';
// ...existing imports...

const ROLE_COLOR: Record<SlotRole, string> = {
  tank: 'var(--color-tank)',
  healer: 'var(--color-healer)',
  dps: 'var(--color-dps)',
};

const ROLE_LABEL: Record<SlotRole, string> = {
  tank: 'Tank',
  healer: 'Healer',
  dps: 'DPS',
};

function isOffspecForSlot(slot: SlotRole, player: WoWPlayer | null): boolean {
  if (!player || player.mainRole == null) return false;
  if (slot === 'tank') return player.mainRole !== 'tank';
  if (slot === 'healer') return player.mainRole !== 'healer';
  // dps slot: any player whose main role is tank or healer is filling DPS as offspec.
  return player.mainRole === 'tank' || player.mainRole === 'healer';
}
```

Replace the inner `slots.map(...)` in the JSX with:

```tsx
{slots.map((slot, i) => {
  const offspec = isOffspecForSlot(slot.role, slot.player);
  const color = ROLE_COLOR[slot.role];
  const label = ROLE_LABEL[slot.role];
  const ariaLabel = slot.player ? `${label}${offspec ? ' (offspec)' : ''}` : `${label} slot empty`;

  return (
    <div className="group-slide__col" key={i} data-role={slot.role}>
      <span
        className={`group-slide__role-icon${offspec ? ' is-offspec' : ''}${slot.player ? '' : ' is-empty'}`}
        style={offspec ? { borderColor: color } : { background: color }}
        role="img"
        aria-label={ariaLabel}
        title={ariaLabel}
      />
    </div>
  );
})}
```

- [ ] **Step 2: Style the role icon**

Append to `activity/src/index.css`:

```css
.group-slide__role-icon {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid transparent;
  flex-shrink: 0;
}

.group-slide__role-icon.is-offspec {
  background: transparent;
  border-style: solid;
  border-width: 2px;
}

.group-slide__role-icon.is-empty {
  background: var(--border-subtle, #2a2a2a);
  opacity: 0.4;
}
```

- [ ] **Step 3: Verify the story renders**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass.

- [ ] **Step 4: Commit**

```bash
git add activity/src/components/GroupSlide.tsx activity/src/index.css
git commit -m "feat(activity): role icon row for GroupSlide"
```

---

## Task 3: `GroupSlide` — utility icon row

**Files:**
- Modify: `activity/src/components/GroupSlide.tsx`
- Modify: `activity/src/index.css`

Add a second row showing brez/lust icons. Empty cells reserve identical height so columns line up across players.

- [ ] **Step 1: Add a utility row after the role icon**

In `activity/src/components/GroupSlide.tsx`, import the existing utility helper:

```tsx
import { utilityIcons } from '../lib/roles';
```

Inside the `slots.map` column body, after the role icon, add:

```tsx
<span
  className="group-slide__utility-row"
  aria-label={slot.player ? utilityIcons(slot.player).trim() || 'No utilities' : 'No utilities'}
>
  {slot.player ? utilityIcons(slot.player).trim() : ''}
</span>
```

`utilityIcons` returns leading-spaced emojis (`" ⚰️ 🎺"` for both); `.trim()` removes the leading space so the cell is centered. Empty string yields a height-reserved blank cell via CSS.

- [ ] **Step 2: Style the utility row**

Append to `activity/src/index.css`:

```css
.group-slide__utility-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.25rem;
  font-size: 1rem;
  letter-spacing: 0.1em;
  line-height: 1;
}
```

- [ ] **Step 3: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass.

- [ ] **Step 4: Commit**

```bash
git add activity/src/components/GroupSlide.tsx activity/src/index.css
git commit -m "feat(activity): utility icon row for GroupSlide"
```

---

## Task 4: `GroupSlide` — portrait + name row

**Files:**
- Modify: `activity/src/components/GroupSlide.tsx`
- Modify: `activity/src/index.css`

Reuse the existing `SpotlightPortrait` (singular) for filled slots; render a faded placeholder portrait for empty slots so columns line up.

- [ ] **Step 1: Render portraits**

In `activity/src/components/GroupSlide.tsx`, import:

```tsx
import { SpotlightPortrait } from './SpotlightPortrait';
```

Update `GroupSlideProps` destructuring to include `scoresByDiscordId`:

```tsx
export function GroupSlide({ group, index, label, scoresByDiscordId }: GroupSlideProps) {
```

Inside the column body, after the utility row, add:

```tsx
{slot.player ? (
  <SpotlightPortrait
    name={slot.player.name}
    characterClass={slot.player.characterClass}
    mediaUrl={slot.player.mediaUrl}
    scores={
      slot.player.discordId
        ? scoresByDiscordId?.get(slot.player.discordId) ?? null
        : null
    }
  />
) : (
  <div className="group-slide__portrait-placeholder" aria-hidden="true">
    <span className="group-slide__placeholder-glyph">?</span>
  </div>
)}
```

Note: `SpotlightPortrait` already renders the player's name under the portrait (`.spotlight-portrait__name`), so we do not need a separate name row — the existing component handles both portrait and name.

- [ ] **Step 2: Style the placeholder portrait**

Append to `activity/src/index.css`:

```css
.group-slide__portrait-placeholder {
  width: clamp(72px, 9vw, 120px);
  height: clamp(96px, 12vw, 160px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-card) 60%, transparent);
  border: 1px dashed var(--border-subtle);
  opacity: 0.4;
}

.group-slide__placeholder-glyph {
  font-size: 2rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}
```

- [ ] **Step 3: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass.

- [ ] **Step 4: Commit**

```bash
git add activity/src/components/GroupSlide.tsx activity/src/index.css
git commit -m "feat(activity): portrait row for GroupSlide"
```

---

## Task 5: `GroupSlide` — Copy Invite button

**Files:**
- Modify: `activity/src/components/GroupSlide.tsx`
- Modify: `activity/src/index.css`
- Modify: `activity/src/components/GroupSlide.stories.tsx`

Add a centered, larger "Copy Invite" button below the grid. Reuse the same clipboard logic that lives in `GroupCard.tsx` (lift it inline; do not import from `GroupCard`).

- [ ] **Step 1: Add the Copy Invite button to the slide**

In `activity/src/components/GroupSlide.tsx`, add imports and helper:

```tsx
import { useState } from 'react';
import { useAppStore } from '../store/store';
import { generateInviteCommand } from '@mythicplus/shared';
```

Add this helper at module scope (mirrors `GroupCard.tsx` so this component remains self-contained):

```tsx
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
```

Inside `GroupSlide`, before `return`:

```tsx
const currentPlayerId = useAppStore((s) => s.currentPlayerId);
const inviteCmd = generateInviteCommand(group, currentPlayerId ?? undefined);
const hasInvite = inviteCmd.length > 0;
const [copied, setCopied] = useState(false);

const handleCopy = async () => {
  await copyToClipboard(inviteCmd);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

After the closing `</div>` of `.group-slide__grid`, before the closing `</div>` of `.group-slide`, add:

```tsx
{hasInvite && (
  <button
    type="button"
    className="group-slide__copy-invite"
    onClick={handleCopy}
    aria-label={`Copy invite command for ${heading}`}
  >
    {copied ? 'Copied!' : 'Copy Invite'}
  </button>
)}
```

- [ ] **Step 2: Style the button**

Append to `activity/src/index.css`:

```css
.group-slide__copy-invite {
  margin-top: 4px;
  padding: 10px 24px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md, 6px);
  color: var(--text-secondary);
  font-family: var(--font-family);
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
  min-width: 180px;
}

.group-slide__copy-invite:hover {
  border-color: var(--color-gold);
  color: var(--color-gold);
  background: color-mix(in srgb, var(--color-gold) 8%, transparent);
}
```

- [ ] **Step 3: Add a story for the no-invite case**

In `activity/src/components/GroupSlide.stories.tsx`, append:

```tsx
// `generateInviteCommand` returns an empty string when the group has no
// other players to invite. Single-player remainder reproduces that.
import type { WoWGroup } from '../types';
import { showcasePlayers } from '../lib/showcaseFixtures';

const singlePlayerRemainder: WoWGroup = {
  tank: null,
  healer: null,
  dps: [showcasePlayers[10]],
};

export const RemainderNoInvite: Story = {
  args: { group: singlePlayerRemainder, index: 99, label: 'Remainder' },
};
```

- [ ] **Step 4: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass.

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/GroupSlide.tsx activity/src/components/GroupSlide.stories.tsx activity/src/index.css
git commit -m "feat(activity): copy invite button for GroupSlide"
```

---

## Task 6: `GroupSlide` — off-spec story coverage

**Files:**
- Modify: `activity/src/components/GroupSlide.stories.tsx`

Add an explicit story that exercises a tank-main filling a DPS slot (off-spec ring), proving the role-icon styling distinguishes off-specs.

- [ ] **Step 1: Add an off-spec story**

Append to `activity/src/components/GroupSlide.stories.tsx`:

```tsx
import type { WoWPlayer } from '../types';

// Re-use a tank-main and put them in a DPS slot to exercise offspec rendering.
const offspecGroup: WoWGroup = {
  tank: showcasePlayers[0], // Gazzi (tank main)
  healer: showcasePlayers[1],
  dps: [
    // Same Gazzi data, different name and discordId so the slide treats it as
    // a separate slot occupant. mainRole stays 'tank' so this DPS column is
    // marked as offspec.
    {
      ...showcasePlayers[0],
      name: 'Gazzi-DPS',
      discordId: 'p01-dps',
    } as WoWPlayer,
    showcasePlayers[3],
    showcasePlayers[4],
  ],
};

export const OffspecDPS: Story = {
  args: { group: offspecGroup, index: 0 },
};
```

- [ ] **Step 2: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass.

- [ ] **Step 3: Commit**

```bash
git add activity/src/components/GroupSlide.stories.tsx
git commit -m "test(activity): GroupSlide offspec story"
```

---

## Task 7: `GroupCarousel` — controlled state + slide layout (no animation yet)

**Files:**
- Create: `activity/src/components/GroupCarousel.tsx`
- Create: `activity/src/components/GroupCarousel.stories.tsx`
- Modify: `activity/src/index.css`

Lay down the carousel container that takes a list of groups and a controlled `activeIndex`. This task only renders the active slide centered with side peeks rendered statically (no transition yet).

- [ ] **Step 1: Create the carousel component**

Create `activity/src/components/GroupCarousel.tsx`:

```tsx
import { GroupSlide } from './GroupSlide';
import type { WoWGroup } from '../types';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';

export interface GroupCarouselItem {
  group: WoWGroup;
  index: number;
  label?: string;
}

export interface GroupCarouselProps {
  items: ReadonlyArray<GroupCarouselItem>;
  activeIndex: number;
  onActiveIndexChange: (next: number) => void;
  scoresByDiscordId?: ReadonlyMap<string, CharacterDungeonScores | null>;
}

export function GroupCarousel({
  items,
  activeIndex,
  onActiveIndexChange,
  scoresByDiscordId,
}: GroupCarouselProps) {
  if (items.length === 0) return null;

  const clamped = Math.max(0, Math.min(activeIndex, items.length - 1));
  const single = items.length === 1;

  return (
    <div
      className={`group-carousel${single ? ' group-carousel--single' : ''}`}
      data-testid="group-carousel"
    >
      <div className="group-carousel__viewport">
        <div
          className="group-carousel__track"
          style={{ transform: `translateX(${-clamped * 100}%)` }}
        >
          {items.map((item, i) => {
            const offset = i - clamped;
            const role =
              offset === 0 ? 'active' : Math.abs(offset) === 1 ? 'peek' : 'distant';
            return (
              <div
                key={item.index}
                className={`group-carousel__slide group-carousel__slide--${role}`}
                aria-hidden={offset !== 0}
                onClick={() => offset !== 0 && onActiveIndexChange(i)}
              >
                <GroupSlide
                  group={item.group}
                  index={item.index}
                  label={item.label}
                  scoresByDiscordId={scoresByDiscordId}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="group-carousel__live" aria-live="polite" aria-atomic="true">
        Group {clamped + 1} of {items.length}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Style the carousel viewport + track**

Append to `activity/src/index.css`:

```css
/* ============================================
   GroupCarousel
   ============================================ */
.group-carousel {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.group-carousel__viewport {
  position: relative;
  width: 100%;
  overflow: hidden;
  padding: 16px 0;
}

.group-carousel__track {
  display: flex;
  align-items: flex-start;
  transition: transform 250ms ease-out;
  will-change: transform;
}

.group-carousel__slide {
  flex: 0 0 100%;
  display: flex;
  justify-content: center;
  transition: opacity 250ms ease-out, transform 250ms ease-out;
}

.group-carousel__slide--active {
  opacity: 1;
  transform: scale(1);
}

.group-carousel__slide--peek {
  opacity: 0.4;
  transform: scale(0.8);
  cursor: pointer;
}

.group-carousel__slide--distant {
  opacity: 0;
  pointer-events: none;
}

.group-carousel__live {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
```

> Side-peek visibility is added in Task 9 by widening the track / using negative margins; for now slides are full-width and only the active slide is visible.

- [ ] **Step 3: Add a basic story**

Create `activity/src/components/GroupCarousel.stories.tsx`:

```tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStore } from '../../.storybook/decorators';
import { showcaseGroups, SHOWCASE_CURRENT_PLAYER_ID } from '../lib/showcaseFixtures';
import { GroupCarousel, type GroupCarouselItem } from './GroupCarousel';

const items: GroupCarouselItem[] = [
  { group: showcaseGroups[0], index: 0 },
  { group: showcaseGroups[1], index: 1 },
  { group: showcaseGroups[2], index: 2, label: 'Remainder' },
];

const meta = {
  title: 'Organisms/GroupCarousel',
  component: GroupCarousel,
  parameters: { layout: 'fullscreen' },
  decorators: [withStore({ currentPlayerId: SHOWCASE_CURRENT_PLAYER_ID })],
} satisfies Meta<typeof GroupCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

function Wrapper(props: { initial: number; items: GroupCarouselItem[] }) {
  const [active, setActive] = useState(props.initial);
  return (
    <GroupCarousel
      items={props.items}
      activeIndex={active}
      onActiveIndexChange={setActive}
    />
  );
}

export const ThreeGroupsRemainder: Story = {
  render: () => <Wrapper initial={1} items={items} />,
};

export const SingleGroup: Story = {
  render: () => <Wrapper initial={0} items={[items[0]]} />,
};
```

- [ ] **Step 4: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass.

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/GroupCarousel.tsx activity/src/components/GroupCarousel.stories.tsx activity/src/index.css
git commit -m "feat(activity): GroupCarousel base layout"
```

---

## Task 8: `GroupCarousel` — side-peek visibility

**Files:**
- Modify: `activity/src/components/GroupCarousel.tsx`
- Modify: `activity/src/index.css`

Make adjacent slides visible at reduced scale on either side of the active slide, and let the viewport overflow show ~12% of each peek.

- [ ] **Step 1: Update the carousel to render with peek width**

The track already has `transform: translateX(-N * 100%)` using `clamped`. To peek, the active slide is narrower than 100% of the viewport so adjacent slides bleed in.

In `activity/src/index.css`, replace the `.group-carousel__slide` rule and add a per-slide width variable:

```css
.group-carousel {
  --group-carousel-slide-width: 76%;
}

.group-carousel__slide {
  flex: 0 0 var(--group-carousel-slide-width);
  display: flex;
  justify-content: center;
  transition: opacity 250ms ease-out, transform 250ms ease-out;
  padding: 0 12px;
  box-sizing: border-box;
}
```

And update the track transform to align the active slide horizontally centered:

In `activity/src/components/GroupCarousel.tsx`, replace the `style` on the track with:

```tsx
style={{
  transform: `translateX(calc(50% - ${clamped} * var(--group-carousel-slide-width) - var(--group-carousel-slide-width) / 2))`,
}}
```

This centers the active slide regardless of width.

- [ ] **Step 2: Make distant slides invisible but keep them in flow**

Existing `.group-carousel__slide--distant` already sets `opacity: 0`; that's fine. They sit off-viewport thanks to overflow hidden.

- [ ] **Step 3: Add a narrow-viewport variant**

Append to `activity/src/index.css`:

```css
@media (max-width: 640px) {
  .group-carousel {
    --group-carousel-slide-width: 86%;
  }

  .group-carousel__slide--peek {
    opacity: 0.25;
    transform: scale(0.85);
  }
}
```

- [ ] **Step 4: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass.

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/GroupCarousel.tsx activity/src/index.css
git commit -m "feat(activity): GroupCarousel side peek visibility"
```

---

## Task 9: `GroupCarousel` — arrow buttons + keyboard

**Files:**
- Modify: `activity/src/components/GroupCarousel.tsx`
- Modify: `activity/src/index.css`

Add left/right arrow buttons flanking the active slide and `ArrowLeft` / `ArrowRight` keyboard support.

- [ ] **Step 1: Render arrow buttons**

In `activity/src/components/GroupCarousel.tsx`, before the `</div>` of `.group-carousel`, but after the viewport, add:

```tsx
{!single && (
  <>
    <button
      type="button"
      className="group-carousel__arrow group-carousel__arrow--prev"
      aria-label="Previous group"
      onClick={() => onActiveIndexChange(clamped - 1)}
      disabled={clamped === 0}
    >
      <ArrowChevron direction="left" />
    </button>
    <button
      type="button"
      className="group-carousel__arrow group-carousel__arrow--next"
      aria-label="Next group"
      onClick={() => onActiveIndexChange(clamped + 1)}
      disabled={clamped === items.length - 1}
    >
      <ArrowChevron direction="right" />
    </button>
  </>
)}
```

Add the chevron icon at the top of the file (after imports):

```tsx
function ArrowChevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === 'left' ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Add keyboard navigation**

Add a `useEffect` import and `useRef` import:

```tsx
import { useEffect, useRef } from 'react';
```

Add a ref on the viewport:

```tsx
const viewportRef = useRef<HTMLDivElement>(null);
```

Apply it: `<div className="group-carousel__viewport" ref={viewportRef} tabIndex={single ? -1 : 0}>`.

Inside the component, add a key handler:

```tsx
useEffect(() => {
  const el = viewportRef.current;
  if (!el || single) return;
  const onKey = (e: KeyboardEvent) => {
    if (document.activeElement !== el) return;
    if (e.key === 'ArrowLeft' && clamped > 0) {
      e.preventDefault();
      onActiveIndexChange(clamped - 1);
    } else if (e.key === 'ArrowRight' && clamped < items.length - 1) {
      e.preventDefault();
      onActiveIndexChange(clamped + 1);
    }
  };
  el.addEventListener('keydown', onKey);
  return () => el.removeEventListener('keydown', onKey);
}, [clamped, items.length, onActiveIndexChange, single]);
```

- [ ] **Step 3: Style the arrows**

Append to `activity/src/index.css`:

```css
.group-carousel__arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg-card) 70%, transparent);
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  z-index: 1;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}

.group-carousel__arrow--prev { left: 8px; }
.group-carousel__arrow--next { right: 8px; }

.group-carousel__arrow:hover:not(:disabled) {
  border-color: var(--color-gold);
  color: var(--color-gold);
}

.group-carousel__arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.group-carousel__viewport:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 4px;
  border-radius: 4px;
}
```

- [ ] **Step 4: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass.

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/GroupCarousel.tsx activity/src/index.css
git commit -m "feat(activity): GroupCarousel arrows + keyboard nav"
```

---

## Task 10: `GroupCarousel` — touch swipe

**Files:**
- Modify: `activity/src/components/GroupCarousel.tsx`

Add horizontal pointer-drag swipe with a small threshold for mobile.

- [ ] **Step 1: Add pointer event handlers**

In `activity/src/components/GroupCarousel.tsx`, inside the component, add:

```tsx
const dragStartXRef = useRef<number | null>(null);
const SWIPE_THRESHOLD_PX = 40;

const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
  if (single) return;
  dragStartXRef.current = e.clientX;
};

const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
  const startX = dragStartXRef.current;
  dragStartXRef.current = null;
  if (startX == null || single) return;
  const dx = e.clientX - startX;
  if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
  if (dx < 0 && clamped < items.length - 1) {
    onActiveIndexChange(clamped + 1);
  } else if (dx > 0 && clamped > 0) {
    onActiveIndexChange(clamped - 1);
  }
};
```

Apply to the viewport:

```tsx
<div
  className="group-carousel__viewport"
  ref={viewportRef}
  tabIndex={single ? -1 : 0}
  onPointerDown={handlePointerDown}
  onPointerUp={handlePointerUp}
  onPointerCancel={() => { dragStartXRef.current = null; }}
>
```

- [ ] **Step 2: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass.

- [ ] **Step 3: Commit**

```bash
git add activity/src/components/GroupCarousel.tsx
git commit -m "feat(activity): GroupCarousel pointer-drag swipe"
```

---

## Task 11: Vitest test for carousel navigation logic

**Files:**
- Create: `activity/tests/group-carousel.test.ts` (or `.tsx` if rendering JSX)

Cover: arrow click increments/decrements active index; disabled at edges; click on peek slide jumps.

- [ ] **Step 1: Write the failing test**

Create `activity/tests/group-carousel.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { GroupCarousel, type GroupCarouselItem } from '../src/components/GroupCarousel';
import { showcaseGroups } from '../src/lib/showcaseFixtures';

function Harness({ initial, items }: { initial: number; items: GroupCarouselItem[] }) {
  const [i, setI] = useState(initial);
  return (
    <>
      <span data-testid="active">{i}</span>
      <GroupCarousel items={items} activeIndex={i} onActiveIndexChange={setI} />
    </>
  );
}

const items: GroupCarouselItem[] = [
  { group: showcaseGroups[0], index: 0 },
  { group: showcaseGroups[1], index: 1 },
  { group: showcaseGroups[2], index: 2, label: 'Remainder' },
];

describe('GroupCarousel navigation', () => {
  it('next arrow advances active index', async () => {
    const user = userEvent.setup();
    render(<Harness initial={0} items={items} />);
    await user.click(screen.getByLabelText('Next group'));
    expect(screen.getByTestId('active')).toHaveTextContent('1');
  });

  it('prev arrow is disabled at start', () => {
    render(<Harness initial={0} items={items} />);
    expect(screen.getByLabelText('Previous group')).toBeDisabled();
  });

  it('next arrow is disabled at end', () => {
    render(<Harness initial={items.length - 1} items={items} />);
    expect(screen.getByLabelText('Next group')).toBeDisabled();
  });

  it('hides arrows for a single-item carousel', () => {
    render(<Harness initial={0} items={[items[0]]} />);
    expect(screen.queryByLabelText('Previous group')).toBeNull();
    expect(screen.queryByLabelText('Next group')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails first if the component missed any wiring**

Run: `cd activity && npm run test -- group-carousel`

Expected: PASS (since the carousel has all the behavior already by Task 10). If anything fails, fix the carousel implementation, not the test.

- [ ] **Step 3: Commit**

```bash
git add activity/tests/group-carousel.test.tsx
git commit -m "test(activity): GroupCarousel navigation behavior"
```

---

## Task 12: `ResultsView` — replace portraits + group-cards with carousel

**Files:**
- Modify: `activity/src/views/ResultsView.tsx`
- Modify: `activity/src/index.css`

Lift `activeSlideIndex`, swap the two old sections for `<GroupCarousel>`, and tighten layout. Suggested Keys still uses `suggestionsPlayers` (unchanged scope) at this step — Task 13 re-scopes it.

- [ ] **Step 1: Lift `activeSlideIndex` and render the carousel**

Open `activity/src/views/ResultsView.tsx`. Replace the import of `SpotlightPortraits` with `GroupCarousel`:

Remove:

```tsx
import { GroupCard } from '../components/GroupCard';
import { SpotlightPortraits } from '../components/SpotlightPortraits';
```

Add:

```tsx
import { GroupCarousel, type GroupCarouselItem } from '../components/GroupCarousel';
```

Inside `ResultsView`, add `useState` for active slide (seeded from `yourGroupIndex`):

```tsx
const initialSlide = Math.max(0, yourGroupIndex);
const [activeSlideIndex, setActiveSlideIndex] = useState<number>(initialSlide);
useEffect(() => {
  // Reseed when the viewer's group changes (e.g., late identity resolution).
  if (yourGroupIndex >= 0) setActiveSlideIndex(yourGroupIndex);
  // Intentionally omit activeSlideIndex from deps so manual nav isn't overridden.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [yourGroupIndex]);
```

Build the carousel items:

```tsx
const carouselItems = useMemo<GroupCarouselItem[]>(() => {
  return groups.map((g, i) => ({
    group: g,
    index: i,
    label: isCompleteGroup(g) ? undefined : 'Remainder',
  }));
}, [groups]);
```

Replace the JSX block currently containing `results-your-group`, `DungeonSuggestions`, `final-groups`, and `results-actions` with this new layout (preserve `DungeonSuggestions`, just move and remove the duplicate group rendering):

```tsx
<section id="view-results">
  {carouselItems.length > 0 && (
    <GroupCarousel
      items={carouselItems}
      activeIndex={activeSlideIndex}
      onActiveIndexChange={setActiveSlideIndex}
      scoresByDiscordId={scoresByDiscordId}
    />
  )}
  <DungeonSuggestions
    {...dungeonSuggestionsState}
    layout="horizontal"
    keyLevel={keyLevel}
    onKeyLevelChange={handleKeyLevelChange}
  />
  <div className="results-actions">
    <SecondaryButton
      id="new-round-btn"
      large
      icon={<RotateIcon />}
      onClick={handleNewRound}
    >
      New Round
    </SecondaryButton>
    {reportSubmitted && (
      <p className="report-success" role="status">Report submitted. Thank you!</p>
    )}
  </div>
</section>
```

`yourGroupHeading`, `yourGroupPlayers`, and `suggestionsPlayers` remain — they still drive `useDungeonSuggestions`. The `final-groups` `<div>` and the `results-your-group` block are gone.

- [ ] **Step 2: Tighten the results layout for vertical density**

Append to `activity/src/index.css`:

```css
#view-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 1.5vh, 20px);
  padding-bottom: 16px;
}

#view-results > .group-carousel {
  width: 100%;
}
```

- [ ] **Step 3: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass. ESLint may complain about unused `GroupCard` / `SpotlightPortraits` imports if they are not removed — fix by removing them.

- [ ] **Step 4: Manual smoke**

Run the dev server in another terminal:

```bash
cd activity && npm run dev
```

Open the activity in the browser and walk through the demo flow until results. Verify:

- The carousel shows your group centered, with adjacent groups peeking on the sides.
- Arrow buttons advance / retreat; disabled at the ends.
- Click on a side-peek slide jumps to it.
- Keyboard ←/→ works when the viewport has focus.
- The Suggested Keys panel and New Round button are visible without scrolling on a typical desktop window.

- [ ] **Step 5: Commit**

```bash
git add activity/src/views/ResultsView.tsx activity/src/index.css
git commit -m "feat(activity): wire GroupCarousel into ResultsView"
```

---

## Task 13: `ResultsView` — re-scope Suggested Keys to active slide

**Files:**
- Modify: `activity/src/views/ResultsView.tsx`

Switch `useDungeonSuggestions` from `suggestionsPlayers` (viewer's group / fallback) to the active carousel slide's players. Show a "suggestions unavailable — incomplete group" empty state for remainder slides instead of misleading rankings against 1–2 players. Cross-fade the panel on slide change.

- [ ] **Step 1: Derive active-slide players**

In `activity/src/views/ResultsView.tsx`, add:

```tsx
const activeGroup = groups[activeSlideIndex];
const activeSlideIsComplete = activeGroup ? isCompleteGroup(activeGroup) : false;

const activeGroupPlayers = useMemo<WoWPlayer[]>(() => {
  if (!activeGroup) return [];
  const out: WoWPlayer[] = [];
  if (activeGroup.tank) out.push(activeGroup.tank);
  if (activeGroup.healer) out.push(activeGroup.healer);
  out.push(...activeGroup.dps);
  return out;
}, [activeGroup]);
```

Replace the existing `useDungeonSuggestions` call:

```tsx
const { state: dungeonSuggestionsState, scoresByDiscordId } =
  useDungeonSuggestions(activeGroupPlayers, keyLevel);
```

Remove the now-unused `suggestionsPlayers` block (the `useMemo` that built the fallback). `yourGroupPlayers` and `yourGroupHeading` can also be removed if no other JSX references them after Task 12 — verify and remove.

- [ ] **Step 2: Show an empty state for remainder slides**

Wrap the `<DungeonSuggestions>` JSX with a conditional:

```tsx
{activeSlideIsComplete ? (
  <DungeonSuggestions
    {...dungeonSuggestionsState}
    layout="horizontal"
    keyLevel={keyLevel}
    onKeyLevelChange={handleKeyLevelChange}
  />
) : (
  <div className="results-suggestions-empty" role="status">
    Suggested Keys unavailable for incomplete groups.
  </div>
)}
```

Append to `activity/src/index.css`:

```css
.results-suggestions-empty {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 16px 0;
  min-height: 56px;
}
```

- [ ] **Step 3: Cross-fade the panel on slide change**

Wrap the conditional in a keyed container so React remounts on slide change and the CSS animation runs:

```tsx
<div
  key={activeSlideIndex}
  className="results-suggestions-fade"
>
  {activeSlideIsComplete ? (
    /* ...existing DungeonSuggestions... */
  ) : (
    /* ...existing empty state... */
  )}
</div>
```

Append to `activity/src/index.css`:

```css
.results-suggestions-fade {
  animation: resultsSuggestionsFade 200ms ease-out;
  width: 100%;
}

@keyframes resultsSuggestionsFade {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

- [ ] **Step 4: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass.

Manual smoke: navigating between groups in the carousel updates the Suggested Keys panel and cross-fades.

- [ ] **Step 5: Commit**

```bash
git add activity/src/views/ResultsView.tsx activity/src/index.css
git commit -m "feat(activity): re-scope Suggested Keys to active carousel slide"
```

---

## Task 14: Tighten affixes-bar padding

**Files:**
- Modify: `activity/src/index.css`

Recover ~8–12px of vertical room from the header to ensure the New Round button fits on shorter viewports.

- [ ] **Step 1: Locate the affixes-bar styles**

Run: `grep -n "affix-bar\|app-header" activity/src/index.css | head`

- [ ] **Step 2: Reduce padding**

In `activity/src/index.css`, find the `.affix-bar` rule and reduce its block padding by ~30%. If it currently uses `padding: 12px 16px`, change to `padding: 8px 16px`. (The exact value depends on the current rule; preserve horizontal padding.)

> If the rule is already at ~8px or less, skip this task — the carousel + density gains in Task 12 should suffice.

- [ ] **Step 3: Verify**

Run: `./scripts/verify-activity.sh`

Expected: typecheck + build pass. Smoke-test that the affixes still read well.

- [ ] **Step 4: Commit**

```bash
git add activity/src/index.css
git commit -m "style(activity): tighten affixes bar for vertical density"
```

---

## Task 15: Regenerate Playwright visual snapshots

**Files:**
- Modify: `activity/tests/__screenshots__/` (whatever paths exist for the affected stories)

Per CLAUDE.md, any UI change must regenerate snapshots inside Docker.

- [ ] **Step 1: Run the snapshot updater**

Run: `./scripts/playwright-docker.sh --update-snapshots`

Expected: snapshots regenerated for `ResultsView` stories and any `GroupSlide` / `GroupCarousel` stories that have visual coverage.

- [ ] **Step 2: Run Playwright once more without `--update-snapshots` to confirm pixel-stable**

Run: `./scripts/playwright-docker.sh`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add activity/tests/__screenshots__/
git commit -m "test(activity): regenerate Playwright snapshots for results carousel"
```

---

## Task 16: Final verification + manual smoke checklist

**Files:**
- None (verification-only)

- [ ] **Step 1: Backend + frontend full verification**

Run in parallel:

- `./scripts/verify-ts.sh` (Backend lint + typecheck + tests)
- `./scripts/verify-activity.sh` (Frontend typecheck + build + Playwright)

Expected: both PASS.

- [ ] **Step 2: Manual smoke against the dev server**

Run: `cd activity && npm run dev`

Walk through the activity demo to results and verify:

- Carousel centers on the viewer's group on first load.
- Arrows / keyboard / click-on-peek / swipe all change the active slide.
- Suggested Keys panel updates per slide and cross-fades.
- Remainder slide shows the empty-state copy for Suggested Keys.
- New Round button is visible without scrolling on a 1440×900 desktop window AND when the browser is resized to ~1280×720 (Discord activity iframe size).
- Off-spec slot in the carousel shows the hollow-ring role icon.

If any of those fail, open a follow-up step rather than continuing.

- [ ] **Step 3: Final commit if any tweaks emerged**

If the smoke surfaced fixes, commit with a focused message such as:

```bash
git add <files>
git commit -m "fix(activity): <specific issue from smoke>"
```

Otherwise no further commit is required.

---

## Self-Review

**Spec coverage:**

| Spec section | Implemented in |
| --- | --- |
| `GroupSlide` layout (role row → util row → portraits → names → Copy Invite) | Tasks 1–5 |
| 5-column fixed grid alignment for remainder | Task 1 (slot builder), Task 4 (placeholder portrait) |
| Off-spec marker on role icon | Task 2 |
| Reuse `SpotlightPortrait` (singular) for filled slots | Task 4 |
| Copy Invite hidden when no invite | Task 5 |
| `GroupCarousel` controlled active-index, peek, distant clip | Tasks 7–8 |
| Arrow buttons + keyboard nav | Task 9 |
| Click-on-peek to jump | Task 7 (`onClick` on slide when `offset !== 0`) |
| Touch swipe | Task 10 |
| `aria-live` "Group N of M" | Task 7 |
| Single-group case hides arrows / peeks | Task 7 (`single`), Task 9 (arrow render guard) |
| Lift `activeSlideIndex`; seed from `yourGroupIndex` | Task 12 |
| Re-scope `useDungeonSuggestions` to active slide | Task 13 |
| Remainder empty state for Suggested Keys | Task 13 |
| Cross-fade Suggested Keys on slide change | Task 13 |
| Vertical density (clamps + affixes padding) | Tasks 1, 4, 8, 14 |
| Updated stories | Tasks 1, 5, 6, 7 |
| Vitest navigation test | Task 11 |
| Playwright snapshot regen | Task 15 |
| Final verification | Task 16 |

**Placeholder scan:** No "TBD" / "implement later" / "handle edge cases" / "add error handling". Each step that modifies code shows the code; each command shows expected output.

**Type consistency:**

- `GroupCarouselItem` defined in Task 7 and used identically in Task 12.
- `GroupSlideProps` defined in Task 1; `scoresByDiscordId` added to destructure in Task 4 (consistent with the original prop definition).
- `WoWGroup` shape (`tank: WoWPlayer | null`, `healer: WoWPlayer | null`, `dps: WoWPlayer[]`) used consistently across slot building (Task 1), active-group derivation (Task 13), and `isCompleteGroup` checks (Tasks 12, 13).
- `useDungeonSuggestions(activeGroupPlayers, keyLevel)` signature unchanged from existing usage.

No inconsistencies found.
