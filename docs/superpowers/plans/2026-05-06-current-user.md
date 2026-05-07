# Persistent current-user character — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current user's WoW character a long-lived per-browser concept so the top-right avatar loads on every view, no per-guild re-selection, no Discord sign-in required.

**Architecture:** Per-browser localStorage (`wheelson-character`) becomes the source of truth for the avatar. A new `currentCharacter` store slice is hydrated from it synchronously on boot. Discord ID linkage is opportunistic — when known, ProfileModal edits also mirror to `preferences/{discordId}`. A new `missingCharacterLookup` bucket in `categorizeUnreadyPlayers` adds a pre-spin warning section for typo'd character names.

**Tech Stack:** TypeScript, React 19, Zustand, Vitest (unit), Storybook (component visual), Playwright (E2E visual snapshots in Docker).

**Spec:** `docs/superpowers/specs/2026-05-06-current-user-design.md`

---

## File Structure

**Create:**
- `activity/src/lib/currentCharacter.ts` — localStorage helpers + types + migration
- `activity/src/lib/currentCharacter.test.ts` — unit tests for the helpers

**Modify:**
- `activity/src/store/types.ts` — add `CurrentCharacter` to `AppState`, setter signature
- `activity/src/store/store.ts` — slice initial state + `setCurrentCharacter` setter that writes localStorage
- `activity/src/main.tsx` — call hydration before React renders
- `activity/src/App.tsx` — `resolveLobbyGate` reads global `wheelson-discord-id`
- `activity/src/hooks/useIdentity.ts` — global key + opportunistic mirror on first resolve
- `activity/src/components/ProfileAvatar.tsx` — read from `currentCharacter` slice with `channelData` fallback; show placeholder when empty
- `activity/src/components/HeaderProfileSlot.tsx` — placeholder click also opens ProfileModal
- `activity/src/components/ProfileModal.tsx` — embed RoleEditor inline when in edit mode
- `activity/src/components/RoleEditor.tsx` — accept "profile" mode (write to `currentCharacter` slice + localStorage; mirror to preferences only when Discord ID known)
- `activity/src/lib/roles.ts` — extend `categorizeUnreadyPlayers` with `missingCharacterLookup`
- `activity/src/lib/rolesHelpers.test.ts` — test new bucket
- `activity/src/components/SpinWarningDialog.tsx` — render new bucket section
- `activity/src/components/SpinWarningDialog.stories.tsx` — story for new bucket
- `activity/src/views/LobbyView.tsx` — pass new bucket to dialog
- `activity/src/components/ProfileAvatar.stories.tsx` — stories for placeholder + slice-driven render
- `activity/src/components/ProfileModal.stories.tsx` — story for inline-edit mode
- `activity/tests/components.spec.ts` or new spec — Playwright snapshot for HeaderProfileSlot on Home view

---

### Task 1: localStorage helpers + types

**Files:**
- Create: `activity/src/lib/currentCharacter.ts`
- Create: `activity/src/lib/currentCharacter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `activity/src/lib/currentCharacter.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadStoredCharacter,
  saveStoredCharacter,
  clearStoredCharacter,
  loadStoredDiscordId,
  saveStoredDiscordId,
  migrateLegacyDiscordId,
  CHARACTER_KEY,
  DISCORD_ID_KEY,
} from './currentCharacter';

beforeEach(() => {
  localStorage.clear();
});

describe('loadStoredCharacter', () => {
  it('returns null when nothing is stored', () => {
    expect(loadStoredCharacter()).toBeNull();
  });

  it('returns the parsed character when stored', () => {
    const character = {
      inGameName: 'Tytanium-Stormrage',
      region: 'us',
      mediaUrl: 'https://example.com/avatar.jpg',
      characterClass: 'Druid' as const,
      lookupStatus: 'ok' as const,
      lastUpdated: 1234567890,
    };
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(character));
    expect(loadStoredCharacter()).toEqual(character);
  });

  it('returns null when the stored value is malformed JSON', () => {
    localStorage.setItem(CHARACTER_KEY, '{not json');
    expect(loadStoredCharacter()).toBeNull();
  });

  it('returns null when the stored value is missing required fields', () => {
    localStorage.setItem(CHARACTER_KEY, JSON.stringify({ inGameName: 'X' }));
    expect(loadStoredCharacter()).toBeNull();
  });
});

describe('saveStoredCharacter / clearStoredCharacter', () => {
  it('round-trips a character through localStorage', () => {
    const character = {
      inGameName: 'Foo-Bar',
      region: 'us',
      mediaUrl: null,
      characterClass: null,
      lookupStatus: 'pending' as const,
      lastUpdated: 1,
    };
    saveStoredCharacter(character);
    expect(loadStoredCharacter()).toEqual(character);
  });

  it('clearStoredCharacter removes the key', () => {
    saveStoredCharacter({
      inGameName: 'X', region: 'us', mediaUrl: null, characterClass: null,
      lookupStatus: 'ok', lastUpdated: 0,
    });
    clearStoredCharacter();
    expect(loadStoredCharacter()).toBeNull();
  });
});

describe('loadStoredDiscordId / saveStoredDiscordId', () => {
  it('returns null when nothing is stored', () => {
    expect(loadStoredDiscordId()).toBeNull();
  });

  it('round-trips a Discord ID', () => {
    saveStoredDiscordId('100000000000000007');
    expect(loadStoredDiscordId()).toBe('100000000000000007');
  });
});

describe('migrateLegacyDiscordId', () => {
  it('is a no-op when the new key is already set', () => {
    localStorage.setItem(DISCORD_ID_KEY, 'new-id');
    localStorage.setItem('wheelson-player-guild-1', 'legacy-id');
    migrateLegacyDiscordId();
    expect(localStorage.getItem(DISCORD_ID_KEY)).toBe('new-id');
  });

  it('is a no-op when no legacy keys exist', () => {
    migrateLegacyDiscordId();
    expect(localStorage.getItem(DISCORD_ID_KEY)).toBeNull();
  });

  it('copies a legacy per-guild value to the global key', () => {
    localStorage.setItem('wheelson-player-guild-1', 'legacy-id');
    migrateLegacyDiscordId();
    expect(localStorage.getItem(DISCORD_ID_KEY)).toBe('legacy-id');
  });

  it('leaves legacy keys in place after migration', () => {
    localStorage.setItem('wheelson-player-guild-1', 'legacy-id');
    migrateLegacyDiscordId();
    expect(localStorage.getItem('wheelson-player-guild-1')).toBe('legacy-id');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && npx -w activity vitest run --project=unit currentCharacter`
Expected: FAIL with "Cannot find module './currentCharacter'"

- [ ] **Step 3: Implement helpers**

Create `activity/src/lib/currentCharacter.ts`:

```typescript
import type { CharacterClass } from '@mythicplus/shared';
import { toCharacterClass } from '@mythicplus/shared';

export const CHARACTER_KEY = 'wheelson-character';
export const DISCORD_ID_KEY = 'wheelson-discord-id';
const LEGACY_PREFIX = 'wheelson-player-';

export type CharacterLookupStatus = 'pending' | 'ok' | 'not_found' | 'no_name';

export interface StoredCharacter {
  inGameName: string;
  region: string;
  mediaUrl: string | null;
  characterClass: CharacterClass | null;
  lookupStatus: CharacterLookupStatus;
  lastUpdated: number;
}

const VALID_STATUSES: ReadonlySet<CharacterLookupStatus> = new Set([
  'pending', 'ok', 'not_found', 'no_name',
]);

function isStoredCharacter(value: unknown): value is StoredCharacter {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.inGameName === 'string' &&
    typeof v.region === 'string' &&
    (v.mediaUrl === null || typeof v.mediaUrl === 'string') &&
    (v.characterClass === null || toCharacterClass(v.characterClass) !== null) &&
    typeof v.lookupStatus === 'string' &&
    VALID_STATUSES.has(v.lookupStatus as CharacterLookupStatus) &&
    typeof v.lastUpdated === 'number'
  );
}

export function loadStoredCharacter(): StoredCharacter | null {
  const raw = localStorage.getItem(CHARACTER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isStoredCharacter(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredCharacter(character: StoredCharacter): void {
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(character));
}

export function clearStoredCharacter(): void {
  localStorage.removeItem(CHARACTER_KEY);
}

export function loadStoredDiscordId(): string | null {
  return localStorage.getItem(DISCORD_ID_KEY);
}

export function saveStoredDiscordId(discordId: string): void {
  localStorage.setItem(DISCORD_ID_KEY, discordId);
}

/**
 * One-shot migration of legacy per-guild Discord ID keys into the new global
 * key. Called once on app boot. No-op when the new key already exists or
 * there are no legacy keys. Does not delete legacy keys — they're harmless
 * leftovers.
 */
export function migrateLegacyDiscordId(): void {
  if (localStorage.getItem(DISCORD_ID_KEY)) return;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LEGACY_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) {
        localStorage.setItem(DISCORD_ID_KEY, value);
        return;
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && npx -w activity vitest run --project=unit currentCharacter`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add activity/src/lib/currentCharacter.ts activity/src/lib/currentCharacter.test.ts
git commit -m "feat(activity): add localStorage helpers for current character"
```

---

### Task 2: Add `currentCharacter` store slice

**Files:**
- Modify: `activity/src/store/types.ts`
- Modify: `activity/src/store/store.ts`

- [ ] **Step 1: Add type to `AppState`**

In `activity/src/store/types.ts`, add the import and the new type. Insert after the existing `import` statements:

```typescript
import type { StoredCharacter } from '../lib/currentCharacter';
```

Add a new type alias and the field/setter in `AppState`. Insert after the existing `// Identity` block (around line 28-31):

In the `AppState` interface, add:

```typescript
  // Current-user character (independent of channelData; hydrated from localStorage)
  currentCharacter: StoredCharacter | null;
```

In the `AppState` actions section, add:

```typescript
  setCurrentCharacter: (character: StoredCharacter | null) => void;
```

- [ ] **Step 2: Add slice + setter to store**

In `activity/src/store/store.ts`, add the import at the top:

```typescript
import { saveStoredCharacter, clearStoredCharacter, loadStoredCharacter } from '../lib/currentCharacter';
```

Add `currentCharacter` to the initial state object, alongside `currentPlayerName`/`identityResolved` (around line 23-26):

```typescript
  // Identity
  currentPlayerId: null,
  currentPlayerName: null,
  identityResolved: false,
  currentCharacter: loadStoredCharacter(),
```

Add the setter implementation in the actions block, near `setIdentityResolved`:

```typescript
  setCurrentCharacter: (character) => {
    if (character) {
      saveStoredCharacter(character);
    } else {
      clearStoredCharacter();
    }
    set({ currentCharacter: character });
  },
```

Also reset `currentCharacter` in `resetSession()` so demo-mode doesn't leak across sessions — but DON'T touch localStorage there (logout is a separate concept). Modify the `resetSession` block to NOT reset `currentCharacter` (it's per-browser, not per-session). Confirm that the resetSession block does not include `currentCharacter`.

- [ ] **Step 3: Verify store types compile**

Run: `npm -w activity run typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add activity/src/store/types.ts activity/src/store/store.ts
git commit -m "feat(activity): add currentCharacter store slice"
```

---

### Task 3: Hydrate localStorage on app boot

**Files:**
- Modify: `activity/src/main.tsx`
- Modify: `activity/src/App.tsx`

- [ ] **Step 1: Migrate legacy Discord ID key on boot**

In `activity/src/main.tsx`, add the import near the existing imports:

```typescript
import { migrateLegacyDiscordId, loadStoredDiscordId } from './lib/currentCharacter';
```

Find the place where the app initializes (near the top of the bootstrap, before React renders / before the `setupDiscordSdk` call). Add the migration call as the very first thing the bootstrap does:

```typescript
migrateLegacyDiscordId();
```

This runs synchronously and writes to localStorage. The store's initial-state call to `loadStoredCharacter()` and any subsequent `loadStoredDiscordId()` reads after this point will see the migrated value.

- [ ] **Step 2: Update `App.tsx` to use the global Discord ID key**

In `activity/src/App.tsx`, change the import line at the top to add:

```typescript
import { loadStoredDiscordId } from './lib/currentCharacter';
```

Replace the existing `resolveLobbyGate` body's localStorage read. Find this block:

```typescript
  if (!store.identityResolved) {
    const guildId = store.currentGuildId;
    const savedId = localStorage.getItem(`wheelson-player-${guildId ?? 'unknown'}`);
    const players = store.channelData?.players ?? [];
```

Replace with:

```typescript
  if (!store.identityResolved) {
    const savedId = loadStoredDiscordId();
    const players = store.channelData?.players ?? [];
```

(Remove the unused `guildId` line since we no longer key by guild here.)

- [ ] **Step 3: Verify the app still type-checks and builds**

Run: `npm -w activity run typecheck`
Expected: No errors.

Run: `npm -w activity run build`
Expected: Build completes successfully.

- [ ] **Step 4: Commit**

```bash
git add activity/src/main.tsx activity/src/App.tsx
git commit -m "feat(activity): hydrate global Discord ID + migrate legacy keys on boot"
```

---

### Task 4: Add `missingCharacterLookup` bucket to `roles.ts`

**Files:**
- Modify: `activity/src/lib/roles.ts:249-258`
- Modify: `activity/src/lib/rolesHelpers.test.ts`

- [ ] **Step 1: Write the failing test**

In `activity/src/lib/rolesHelpers.test.ts`, find the existing `categorizeUnreadyPlayers` describe block and add new tests. If a describe block doesn't exist, add one. Append the following test cases inside the relevant describe block:

```typescript
describe('categorizeUnreadyPlayers', () => {
  // ...keep existing tests...

  it('puts players with role + name but no mediaUrl in missingCharacterLookup', () => {
    const broken = player({
      mainRole: 'tank',
      inGameName: 'Foo-Bar',
      mediaUrl: null,
    });
    const result = categorizeUnreadyPlayers([broken], []);
    expect(result.missingCharacterLookup).toEqual([broken]);
    expect(result.missingRole).toEqual([]);
    expect(result.missingNameOnly).toEqual([]);
  });

  it('does not flag players with role + name + mediaUrl', () => {
    const ready = player({
      mainRole: 'tank',
      inGameName: 'Foo-Bar',
      mediaUrl: 'https://example.com/x.jpg',
    });
    const result = categorizeUnreadyPlayers([ready], []);
    expect(result.missingCharacterLookup).toEqual([]);
  });

  it('does not flag players missing the inGameName (those go to missingNameOnly)', () => {
    const noName = player({
      mainRole: 'tank',
      inGameName: undefined,
      mediaUrl: null,
    });
    const result = categorizeUnreadyPlayers([noName], []);
    expect(result.missingCharacterLookup).toEqual([]);
    expect(result.missingNameOnly).toEqual([noName]);
  });

  it('excludes sitting-out players from missingCharacterLookup', () => {
    const broken = player({
      discordId: 'sit-1',
      mainRole: 'tank',
      inGameName: 'Foo-Bar',
      mediaUrl: null,
    });
    const result = categorizeUnreadyPlayers([broken], ['sit-1']);
    expect(result.missingCharacterLookup).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && npx -w activity vitest run --project=unit rolesHelpers`
Expected: FAIL — `missingCharacterLookup` is undefined on the result.

- [ ] **Step 3: Update `categorizeUnreadyPlayers`**

In `activity/src/lib/roles.ts`, replace the existing `categorizeUnreadyPlayers` (around line 249-258) with:

```typescript
/** Categorize unready players for the spin warning dialog. */
export function categorizeUnreadyPlayers(players: WoWPlayer[], sittingOut: string[]): {
  missingRole: WoWPlayer[];
  missingNameOnly: WoWPlayer[];
  missingCharacterLookup: WoWPlayer[];
} {
  const active = activePlayers(players, sittingOut);
  return {
    missingRole: active.filter((p) => p.mainRole === null),
    missingNameOnly: active.filter((p) => p.mainRole !== null && !p.inGameName),
    missingCharacterLookup: active.filter(
      (p) => p.mainRole !== null && !!p.inGameName && !p.mediaUrl,
    ),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && npx -w activity vitest run --project=unit rolesHelpers`
Expected: All tests pass.

- [ ] **Step 5: Verify typecheck**

Run: `npm -w activity run typecheck`
Expected: No errors. (Callers of `categorizeUnreadyPlayers` only destructure `missingRole` and `missingNameOnly` — the new property is additive and won't break them yet.)

- [ ] **Step 6: Commit**

```bash
git add activity/src/lib/roles.ts activity/src/lib/rolesHelpers.test.ts
git commit -m "feat(activity): add missingCharacterLookup bucket for spin gate"
```

---

### Task 5: SpinWarningDialog renders new bucket

**Files:**
- Modify: `activity/src/components/SpinWarningDialog.tsx`
- Modify: `activity/src/components/SpinWarningDialog.stories.tsx`

- [ ] **Step 1: Update the component to accept and render the new bucket**

Replace the contents of `activity/src/components/SpinWarningDialog.tsx` with:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { WoWPlayer } from '../types';
import { SecondaryButton, PrimaryCTA } from './ui';

interface SpinWarningDialogProps {
  missingRole: WoWPlayer[];
  missingNameOnly: WoWPlayer[];
  missingCharacterLookup: WoWPlayer[];
  onGoBack: () => void;
  onSpinAnyway: () => void;
}

export function SpinWarningDialog({
  missingRole,
  missingNameOnly,
  missingCharacterLookup,
  onGoBack,
  onSpinAnyway,
}: SpinWarningDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onGoBack();
  }, [onGoBack]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onGoBack();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onGoBack]);

  return (
    <div className="edit-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="spin-warning" role="alertdialog" aria-label="Not everyone is ready">
        <div className="spin-warning__icon">&#x26A0;&#xFE0F;</div>
        <h3 className="spin-warning__title">Not Everyone Is Ready</h3>
        <p className="spin-warning__subtitle">Some players haven't finished setting up</p>

        {missingRole.length > 0 && (
          <div className="spin-warning__section spin-warning__section--error">
            <div className="spin-warning__section-label">Will be sat out (no role)</div>
            {missingRole.map(p => (
              <div key={p.discordId || p.name} className="spin-warning__player">
                <span>{p.name}</span>
                <span className="spin-warning__reason">no role set</span>
              </div>
            ))}
          </div>
        )}

        {missingNameOnly.length > 0 && (
          <div className="spin-warning__section spin-warning__section--warn">
            <div className="spin-warning__section-label">Missing WoW name (will use Discord name)</div>
            {missingNameOnly.map(p => (
              <div key={p.discordId || p.name} className="spin-warning__player">
                <span>{p.name}</span>
                <span className="spin-warning__reason">has role, no WoW name</span>
              </div>
            ))}
          </div>
        )}

        {missingCharacterLookup.length > 0 && (
          <div className="spin-warning__section spin-warning__section--warn">
            <div className="spin-warning__section-label">Character not found</div>
            {missingCharacterLookup.map(p => (
              <div key={p.discordId || p.name} className="spin-warning__player">
                <span>{p.name}</span>
                <span className="spin-warning__reason">
                  {`'${p.inGameName ?? ''}' didn't resolve — typo?`}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="spin-warning__actions">
          <SecondaryButton onClick={onGoBack}>Go Back</SecondaryButton>
          <PrimaryCTA id="spin-anyway-btn" onClick={onSpinAnyway}>Spin Anyway</PrimaryCTA>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the story to cover the new bucket**

Replace the contents of `activity/src/components/SpinWarningDialog.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpinWarningDialog } from './SpinWarningDialog';
import { mockPlayers } from '../lib/mockData';

const meta = {
  title: 'Organisms/SpinWarningDialog',
  component: SpinWarningDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    onGoBack: () => {},
    onSpinAnyway: () => {},
  },
} satisfies Meta<typeof SpinWarningDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const unassigned = {
  name: 'NewPlayer',
  discordId: '200000000000000001',
  mainRole: null,
  offspecs: [],
  utilities: [],
};
const assignedNoName = { ...mockPlayers[1], inGameName: undefined };
const typoCharacter = {
  ...mockPlayers[1],
  name: 'Typo',
  discordId: '200000000000000002',
  inGameName: 'Tytaniumm-Stomrage',
  mediaUrl: null,
};

export const MissingRoleOnly: Story = {
  args: { missingRole: [unassigned], missingNameOnly: [], missingCharacterLookup: [] },
};

export const MissingNameOnly: Story = {
  args: { missingRole: [], missingNameOnly: [assignedNoName], missingCharacterLookup: [] },
};

export const MissingCharacterLookup: Story = {
  args: { missingRole: [], missingNameOnly: [], missingCharacterLookup: [typoCharacter] },
};

export const All: Story = {
  args: {
    missingRole: [unassigned],
    missingNameOnly: [assignedNoName],
    missingCharacterLookup: [typoCharacter],
  },
};
```

- [ ] **Step 3: Verify the story renders**

Run: `npm -w activity run typecheck`
Expected: No errors. (LobbyView callsite will fail typecheck — that's expected; we fix it next task.)

If the typecheck error is at `LobbyView.tsx` complaining about a missing prop on `SpinWarningDialog`, that's the expected failure. Proceed to Task 6 to fix it.

- [ ] **Step 4: Commit**

```bash
git add activity/src/components/SpinWarningDialog.tsx activity/src/components/SpinWarningDialog.stories.tsx
git commit -m "feat(activity): SpinWarningDialog renders missingCharacterLookup section"
```

---

### Task 6: LobbyView passes new bucket

**Files:**
- Modify: `activity/src/views/LobbyView.tsx`

- [ ] **Step 1: Update LobbyView to pass the third bucket**

In `activity/src/views/LobbyView.tsx`, find the `SpinWarningDialog` rendering at the bottom (around line 283-290) and update the props passed to it:

```typescript
      {showSpinWarning && (
        <SpinWarningDialog
          missingRole={unreadyBreakdown.missingRole}
          missingNameOnly={unreadyBreakdown.missingNameOnly}
          missingCharacterLookup={unreadyBreakdown.missingCharacterLookup}
          onGoBack={() => setShowSpinWarning(false)}
          onSpinAnyway={doSpin}
        />
      )}
```

Also update `handleSpinClick` (around line 41-48) to consider the third bucket — it should trigger the warning dialog when any of the three buckets is non-empty:

```typescript
  const handleSpinClick = () => {
    const { missingRole, missingNameOnly, missingCharacterLookup } = categorizeUnreadyPlayers(players, sittingOut);
    if (missingRole.length > 0 || missingNameOnly.length > 0 || missingCharacterLookup.length > 0) {
      setShowSpinWarning(true);
    } else {
      doSpin();
    }
  };
```

- [ ] **Step 2: Verify typecheck and build**

Run: `npm -w activity run typecheck`
Expected: No errors.

Run: `npm -w activity run build`
Expected: Build succeeds.

- [ ] **Step 3: Run unit tests to confirm no regressions**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && npx -w activity vitest run --project=unit`
Expected: All unit tests pass.

- [ ] **Step 4: Commit**

```bash
git add activity/src/views/LobbyView.tsx
git commit -m "feat(activity): wire missingCharacterLookup bucket into spin gate"
```

---

### Task 7: ProfileAvatar reads from `currentCharacter` slice

**Files:**
- Modify: `activity/src/components/ProfileAvatar.tsx`
- Modify: `activity/src/components/ProfileAvatar.stories.tsx`

- [ ] **Step 1: Update ProfileAvatar to read from slice with channelData fallback**

Replace the contents of `activity/src/components/ProfileAvatar.tsx`:

```typescript
import type { CSSProperties } from 'react';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';
import { useAppStore } from '../store/store';

interface ProfileAvatarProps {
  onClick: () => void;
}

export function ProfileAvatar({ onClick }: ProfileAvatarProps) {
  const currentCharacter = useAppStore((s) => s.currentCharacter);
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const channelData = useAppStore((s) => s.channelData);

  // Prefer the per-browser local character (works on every view, even
  // outside a voice channel). Fall back to channelData lookup for
  // returning users who haven't yet hydrated their local character.
  const channelPlayer = currentPlayerId && channelData
    ? channelData.players.find((p) => p.discordId === currentPlayerId)
    : null;

  const mediaUrl = currentCharacter?.mediaUrl ?? channelPlayer?.mediaUrl ?? null;
  const characterClass = currentCharacter?.characterClass ?? channelPlayer?.characterClass ?? null;
  const displayName = currentCharacter?.inGameName || currentPlayerName || channelPlayer?.name || null;

  const proxied = remapImageUrl(toAvatarUrl(mediaUrl) ?? undefined);
  const ringColor = getClassColor(characterClass) ?? '#888';
  const initial = (displayName ?? '?').charAt(0).toUpperCase();

  // Always actionable — even with no character set, the slot opens
  // ProfileModal so users can set up.
  const ariaLabel = displayName
    ? `Profile of ${displayName}`
    : 'Set up your character';

  return (
    <button
      type="button"
      className={`profile-avatar${!displayName ? ' profile-avatar--placeholder' : ''}`}
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ '--avatar-ring': ringColor } as CSSProperties}
    >
      {proxied ? (
        <img src={proxied} alt="" className="profile-avatar__img" />
      ) : (
        <span className="profile-avatar__initial">{initial}</span>
      )}
    </button>
  );
}
```

Notable changes vs. the previous version:
- Reads `currentCharacter` from store
- Avatar derived from `currentCharacter.mediaUrl` first, channelData second
- Removed `disabled` — the button is always clickable now, even with no character
- Added `profile-avatar--placeholder` className for empty-state styling

- [ ] **Step 2: Update stories to cover slice-driven render and placeholder**

Replace the contents of `activity/src/components/ProfileAvatar.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { mockChannelData, mockPlayers } from '../lib/mockData';
import { ProfileAvatar } from './ProfileAvatar';

const meta = {
  title: 'Molecules/ProfileAvatar',
  component: ProfileAvatar,
  parameters: { layout: 'centered' },
  args: { onClick: fn() },
} satisfies Meta<typeof ProfileAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: null,
    currentPlayerName: null,
    identityResolved: false,
    channelData: null,
    currentCharacter: null,
  })],
};

export const FromCurrentCharacter: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: null,
    currentPlayerName: null,
    identityResolved: false,
    channelData: null,
    currentCharacter: {
      inGameName: 'Tytanium-Stormrage',
      region: 'us',
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/stormrage/1/1234567-inset.jpg',
      characterClass: 'Druid',
      lookupStatus: 'ok',
      lastUpdated: 1234567890,
    },
  })],
};

export const FromChannelDataFallback: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000007',
    currentPlayerName: 'Fourseven',
    identityResolved: true,
    channelData: mockChannelData,
    currentCharacter: null,
  })],
};

export const NoCharacterClass: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '999999999999999999',
    currentPlayerName: 'Mystery',
    identityResolved: true,
    channelData: {
      ...mockChannelData,
      players: [
        ...mockPlayers,
        {
          name: 'Mystery',
          discordId: '999999999999999999',
          mainRole: 'ranged',
          offspecs: [],
          utilities: [],
          mediaUrl: null,
          characterClass: null,
        },
      ],
    },
    currentCharacter: null,
  })],
};
```

- [ ] **Step 3: Add CSS for the placeholder state**

Find `activity/src/index.css`. Search for the existing `.profile-avatar` rules:

Run: `grep -n 'profile-avatar' /Users/tylerholland/Dev/MythicPlusDiscordBot/activity/src/index.css | head -20`

Add a sibling rule for the placeholder near the existing `.profile-avatar` block. The exact line depends on what's there; add this rule somewhere in the same vicinity:

```css
.profile-avatar--placeholder {
  border-style: dashed;
  opacity: 0.7;
}
.profile-avatar--placeholder:hover {
  opacity: 1;
}
```

- [ ] **Step 4: Verify typecheck**

Run: `npm -w activity run typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/ProfileAvatar.tsx activity/src/components/ProfileAvatar.stories.tsx activity/src/index.css
git commit -m "feat(activity): ProfileAvatar reads currentCharacter slice"
```

---

### Task 8: useIdentity uses global key + opportunistic mirror

**Files:**
- Modify: `activity/src/hooks/useIdentity.ts`

- [ ] **Step 1: Replace per-guild key with global key + add sync helper**

Replace the contents of `activity/src/hooks/useIdentity.ts`:

```typescript
import { useCallback } from 'react';
import { useAppStore } from '../store/store';
import { getParticipants } from '../discordSdk';
import { WoWPlayer } from '../types';
import { firestoreService } from '../services/firestoreService';
import { demoService } from '../services/demoService';
import { reportError } from '../lib/sentry';
import {
  loadStoredDiscordId,
  saveStoredDiscordId,
  saveStoredCharacter,
  type StoredCharacter,
} from '../lib/currentCharacter';
import { toCharacterClass } from '@mythicplus/shared';

function getSessionService() {
  return useAppStore.getState().isDemoMode ? demoService : firestoreService;
}

function stripDots(s: string): string {
  return s.replace(/\./g, '');
}

interface CommitOptions {
  /** When true, also write the discordId to localStorage. Skip when the call
   *  site is *reading* from localStorage (the value is already there). */
  persist: boolean;
}

/**
 * Commit a resolved identity to the store and (optionally) persistence.
 * Always sets identity + resolved flag; only writes localStorage and claims
 * the player when there's a non-null discordId, since both are keyed off it.
 */
function commitIdentity(player: WoWPlayer, opts: CommitOptions): void {
  const store = useAppStore.getState();
  store.setIdentity(player.discordId ?? null, player.name);
  store.setIdentityResolved(true);
  if (!player.discordId) return;
  if (opts.persist) {
    saveStoredDiscordId(player.discordId);
  }
  getSessionService().claimPlayer(player.discordId).catch((err) => {
    reportError(err, { tag: 'useIdentity.claimPlayer' });
  });
  syncCharacterAcrossLayers(player);
}

/**
 * One-shot opportunistic sync between localStorage character and
 * preferences/{discordId} when an identity first resolves.
 *
 * - If localStorage is empty AND channelData has character data for this
 *   user, hydrate localStorage so returning users see their avatar without
 *   re-entering it.
 * - If localStorage has data, mirror it to preferences/{discordId} so the
 *   bot can populate channelData for other voice members. Last-write-wins.
 *
 * Fire-and-forget: failures don't surface; the local character keeps
 * working regardless.
 */
function syncCharacterAcrossLayers(player: WoWPlayer): void {
  const store = useAppStore.getState();
  const local = store.currentCharacter;

  if (!local) {
    // Hydrate from channel record if it has anything useful.
    if (player.inGameName || player.mediaUrl) {
      const region = parseRegionFromInGameName(player.inGameName);
      const hydrated: StoredCharacter = {
        inGameName: player.inGameName ?? '',
        region,
        mediaUrl: player.mediaUrl ?? null,
        characterClass: toCharacterClass(player.characterClass),
        lookupStatus: player.mediaUrl ? 'ok' : (player.inGameName ? 'pending' : 'no_name'),
        lastUpdated: Date.now(),
      };
      store.setCurrentCharacter(hydrated);
    }
    return;
  }

  // Mirror localStorage → preferences. Fire-and-forget.
  if (!player.discordId) return;
  const service = getSessionService();
  if (local.inGameName) {
    const parsed = parseInGameName(local.inGameName);
    if (parsed) {
      service.saveLinkedCharacter(
        player.discordId,
        { name: parsed.name, realm: parsed.realmSlug, region: local.region },
        local.mediaUrl,
        local.characterClass,
      ).catch((err) => {
        reportError(err, { tag: 'useIdentity.syncMirror' });
      });
    }
  }
}

function parseRegionFromInGameName(_inGameName: string | undefined): string {
  // No region in the player record today — default to "us".
  // Existing RoleEditor also defaults to "us"; keeping consistent.
  return 'us';
}

function parseInGameName(input: string): { name: string; realmSlug: string } | null {
  const trimmed = input.trim();
  const dashIdx = trimmed.indexOf('-');
  if (dashIdx === -1) return null;
  const name = trimmed.slice(0, dashIdx).trim();
  const realm = trimmed.slice(dashIdx + 1).trim();
  if (!name || !realm) return null;
  const realmSlug = realm
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return { name, realmSlug };
}

export function useIdentity() {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const identityResolved = useAppStore((s) => s.identityResolved);

  const resolveIdentity = useCallback(async (players: WoWPlayer[]) => {
    const state = useAppStore.getState();

    if (state.identityResolved && state.currentPlayerId) {
      const stillHere = players.some((p) => p.discordId === state.currentPlayerId);
      if (stillHere) return;
      // Player left — re-resolve
      state.resetIdentity();
    }

    // Check localStorage — value is already persisted, so don't re-write it.
    const stored = loadStoredDiscordId();
    if (stored) {
      const match = players.find((p) => p.discordId === stored);
      if (match) {
        commitIdentity(match, { persist: false });
        return;
      }
    }

    // Auto-match via Discord participants
    const participants = await getParticipants();
    if (participants.length === 0) return;

    for (const participant of participants) {
      const pName = stripDots(participant.nickname ?? participant.global_name ?? participant.username);
      const match = players.find((p) => p.name === pName);
      if (match && match.discordId) {
        commitIdentity(match, { persist: true });
        return;
      }
    }

    // Try matching by discordId directly
    const participantIds = new Set(participants.map((p) => p.id));
    const idMatches = players.filter((p) => p.discordId && participantIds.has(p.discordId));
    if (idMatches.length === 1) {
      commitIdentity(idMatches[0], { persist: true });
    }

    // Otherwise: no match — identity selector will show in lobby
  }, []);

  const selectPlayer = useCallback((player: WoWPlayer) => {
    commitIdentity(player, { persist: true });
  }, []);

  const clearIdentity = useCallback(() => {
    const state = useAppStore.getState();
    const previousId = state.currentPlayerId;
    // Don't clear localStorage Discord ID here — clearIdentity is only called
    // on Player-Left re-resolution today, which preserves the user's identity
    // across sessions. Switching to a different identity goes through
    // selectPlayer, which overwrites the stored ID.
    state.resetIdentity();
    if (previousId) {
      getSessionService().unclaimPlayer(previousId).catch((err) => {
        reportError(err, { tag: 'useIdentity.unclaimPlayer' });
      });
    }
  }, []);

  return {
    resolveIdentity,
    selectPlayer,
    clearIdentity,
    currentPlayerId,
    currentPlayerName,
    identityResolved,
  };
}
```

Key changes vs. previous version:
- Removed `getIdentityStorageKey(guildId)` — replaced with global `loadStoredDiscordId` / `saveStoredDiscordId`
- `commitIdentity` no longer takes a `guildId` param — global key is implicit
- Added `syncCharacterAcrossLayers()` called from `commitIdentity` — fire-and-forget
- `clearIdentity` no longer touches localStorage (note in code explains why)

- [ ] **Step 2: Verify typecheck**

Run: `npm -w activity run typecheck`
Expected: No errors.

- [ ] **Step 3: Run all unit tests to confirm no regressions**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && npx -w activity vitest run --project=unit`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add activity/src/hooks/useIdentity.ts
git commit -m "feat(activity): useIdentity uses global key + opportunistic sync"
```

---

### Task 9: RoleEditor profile-edit mode

**Files:**
- Modify: `activity/src/components/RoleEditor.tsx`

- [ ] **Step 1: Add profile-edit mode to RoleEditor**

Replace the contents of `activity/src/components/RoleEditor.tsx`:

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useCharacterLookup } from '../hooks/useCharacterLookup';
import { SecondaryButton } from './ui';
import {
  playerRolesToStringArray,
  roleStringsToPlayerFields,
  computeToggledRoles,
  MAIN_SPEC_BUTTONS,
  OFFSPEC_BUTTONS,
  UTILITY_BUTTONS,
  type RoleButtonDef,
} from '../lib/roles';
import { reportError } from '../lib/sentry';
import { saveStoredDiscordId, type StoredCharacter } from '../lib/currentCharacter';

interface RoleEditorProps {
  player: WoWPlayer;
  onMediaUrlChange?: (url: string | null) => void;
  hideSitOut?: boolean;
  /**
   * When true: writes optimistically to `currentCharacter` slice + localStorage
   * (always), and mirrors to preferences/{discordId} only when player.discordId
   * is set. When false (default): writes to channelData via store.updatePlayer
   * and to preferences via firestoreService — same as today.
   */
  isProfileEdit?: boolean;
}

const LOOKUP_DEBOUNCE_MS = 800;
const DEFAULT_REGION = 'us';

function realmToSlug(realm: string): string {
  return realm
    .trim()
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseInGameName(input: string): { name: string; realmSlug: string } | null {
  const trimmed = input.trim();
  const dashIdx = trimmed.indexOf('-');
  if (dashIdx === -1) return null;
  const name = trimmed.slice(0, dashIdx).trim();
  const realm = trimmed.slice(dashIdx + 1).trim();
  if (!name || !realm) return null;
  return { name, realmSlug: realmToSlug(realm) };
}

export function RoleEditor({ player, onMediaUrlChange, hideSitOut, isProfileEdit }: RoleEditorProps) {
  const sittingOut = useAppStore((s) => s.channelData?.sittingOut) ?? [];
  const service = useSessionService();

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [inGameName, setInGameName] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const { lookup, loading: lookupLoading } = useCharacterLookup();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const rolesRef = useRef<Set<string>>(new Set());
  const nameRef = useRef<string>('');

  const playerId = player.discordId ?? null;

  useEffect(() => {
    const next = new Set(playerRolesToStringArray(player));
    setSelectedRoles((prev) => {
      if (prev.size === next.size && [...next].every((r) => prev.has(r))) return prev;
      return next;
    });
    rolesRef.current = next;
  }, [player]);

  useEffect(() => {
    setInGameName(player.inGameName ?? '');
    nameRef.current = player.inGameName ?? '';
    setLookupError(null);
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Persist a partial character update through the appropriate channels.
   * In profile-edit mode: always writes localStorage + slice; mirrors to
   * preferences only when discordId is set.
   * In channel mode (default): writes channelData.players + preferences.
   */
  const persistCharacter = useCallback((opts: {
    roles: Set<string>;
    name: string;
    mediaUrl?: string | null;
    characterClass?: StoredCharacter['characterClass'];
    lookupStatus?: StoredCharacter['lookupStatus'];
  }) => {
    const fields = roleStringsToPlayerFields(opts.roles);

    if (isProfileEdit) {
      // Optimistic local write
      const store = useAppStore.getState();
      const prev = store.currentCharacter;
      const next: StoredCharacter = {
        inGameName: opts.name,
        region: prev?.region ?? DEFAULT_REGION,
        mediaUrl: opts.mediaUrl !== undefined ? opts.mediaUrl : (prev?.mediaUrl ?? null),
        characterClass: opts.characterClass !== undefined ? opts.characterClass : (prev?.characterClass ?? null),
        lookupStatus: opts.lookupStatus ?? prev?.lookupStatus ?? 'pending',
        lastUpdated: Date.now(),
      };
      store.setCurrentCharacter(next);
    } else {
      // Channel-mode optimistic update — same as before
      if (player.discordId) {
        const id = player.discordId;
        queueMicrotask(() => {
          useAppStore.getState().updatePlayer(id, { ...fields, inGameName: opts.name || undefined });
        });
      }
    }
  }, [isProfileEdit, player.discordId]);

  const autoSave = useCallback((roles: Set<string>, name: string) => {
    persistCharacter({ roles, name });

    // Firestore writes are gated on having a Discord ID. In profile-edit
    // mode without a Discord ID, writes are local-only.
    if (!player.discordId) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await service.saveRoles(player.discordId!, player.name, Array.from(roles), name);
        // Persist the discordId hint when this is a profile edit and we
        // happen to have a discordId (e.g., the user is in voice and edited
        // through the modal).
        if (isProfileEdit) {
          saveStoredDiscordId(player.discordId!);
        }
        const store = useAppStore.getState();
        if (!store.identityResolved && player.discordId === store.currentPlayerId) {
          store.setIdentity(player.discordId!, player.name);
          store.setIdentityResolved(true);
          saveStoredDiscordId(player.discordId!);
        }
      } catch (err) {
        reportError(err, { tag: 'RoleEditor.autoSave' });
      }
    }, 500);
  }, [persistCharacter, player.discordId, player.name, service, isProfileEdit]);

  const runLookup = useCallback(async (rawName: string) => {
    const parsed = parseInGameName(rawName);
    if (!parsed) {
      setLookupError(null);
      return;
    }

    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;

    try {
      const character = await lookup(parsed.name, parsed.realmSlug, DEFAULT_REGION);
      if (controller.signal.aborted) return;

      if (!character) {
        setLookupError('Character not found');
        // Persist the failed lookup status in profile mode so the avatar
        // shows the correct state (still triggers spin warning).
        if (isProfileEdit) {
          persistCharacter({
            roles: rolesRef.current,
            name: rawName,
            lookupStatus: 'not_found',
          });
        }
        return;
      }

      setLookupError(null);
      if (character.mediaUrl) onMediaUrlChange?.(character.mediaUrl);

      // Persist successful lookup
      persistCharacter({
        roles: rolesRef.current,
        name: rawName,
        mediaUrl: character.mediaUrl,
        characterClass: character.class,
        lookupStatus: 'ok',
      });

      if (player.discordId) {
        await service.saveLinkedCharacter(
          player.discordId,
          { name: parsed.name, realm: parsed.realmSlug, region: DEFAULT_REGION },
          character.mediaUrl,
          character.class,
        );
      }

      // Auto-assign roles only on the very first successful lookup for this player.
      if (rolesRef.current.size === 0) {
        const roles: string[] = [];
        if (character.role === 'tank') roles.push('Tank');
        else if (character.role === 'healer') roles.push('Healer');
        else if (character.role === 'ranged') roles.push('Ranged');
        else if (character.role === 'melee') roles.push('Melee');
        for (const u of character.utilities) {
          if (u === 'brez') roles.push('Brez');
          if (u === 'lust') roles.push('Lust');
        }
        if (roles.length > 0) {
          const roleSet = new Set(roles);
          setSelectedRoles(roleSet);
          rolesRef.current = roleSet;
          // Persist roles via the same path
          persistCharacter({
            roles: roleSet,
            name: rawName,
            mediaUrl: character.mediaUrl,
            characterClass: character.class,
            lookupStatus: 'ok',
          });
          if (player.discordId) {
            await service.saveRoles(player.discordId, player.name, roles, rawName);
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setLookupError('Character not found');
      reportError(err, { tag: 'RoleEditor.runLookup' });
    }
  }, [player, lookup, service, onMediaUrlChange, isProfileEdit, persistCharacter]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
      lookupAbortRef.current?.abort();
    };
  }, []);

  const toggleRole = useCallback((btnDef: RoleButtonDef, mutuallyExclusive: boolean) => {
    setSelectedRoles((prev) => {
      const next = computeToggledRoles(prev, btnDef.id, mutuallyExclusive);
      rolesRef.current = next;
      autoSave(next, nameRef.current);
      return next;
    });
  }, [autoSave]);

  const handleNameChange = useCallback((value: string) => {
    setInGameName(value);
    nameRef.current = value;
    setLookupError(null);
    autoSave(rolesRef.current, value);

    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = setTimeout(() => runLookup(value), LOOKUP_DEBOUNCE_MS);
  }, [autoSave, runLookup]);

  const isSittingOut = player.discordId ? sittingOut.includes(player.discordId) : false;

  function renderSection(label: string, buttons: RoleButtonDef[], mutuallyExclusive: boolean) {
    return (
      <div className="role-editor-section">
        <div className="role-editor-label">{label}</div>
        <div className="role-editor-row">
          {buttons.map((btnDef) => (
            <button
              key={btnDef.id}
              className={`role-btn${selectedRoles.has(btnDef.id) ? ` ${btnDef.activeClass}` : ''}`}
              data-role-id={btnDef.id}
              onClick={() => toggleRole(btnDef, mutuallyExclusive)}
              aria-pressed={selectedRoles.has(btnDef.id)}
            >
              {btnDef.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="role-editor-section">
        <div className="role-editor-label">In-Game Name</div>
        <div className="role-editor-row">
          <div className="role-editor-name-input">
            <input
              type="text"
              className="role-editor-input"
              placeholder="PlayerName-ServerName"
              value={inGameName}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={50}
            />
            {lookupLoading && (
              <div className="character-search-loading" role="status" aria-live="polite" aria-label="Looking up character" />
            )}
          </div>
        </div>
        {lookupError && (
          <div className="role-editor-error" role="alert">{lookupError}</div>
        )}
      </div>

      {renderSection('Main Spec (pick one)', MAIN_SPEC_BUTTONS, true)}
      {renderSection('Offspec', OFFSPEC_BUTTONS, false)}
      {renderSection('Utilities', UTILITY_BUTTONS, false)}

      {!hideSitOut && (
        <div className="role-editor-section" style={{ marginTop: 4 }}>
          <div className="role-editor-row">
            <SecondaryButton
              className={`player-card__sit-out ${isSittingOut ? 'active-sitting-out' : ''}`}
              onClick={() => { if (player.discordId) service.toggleSitOut(player.discordId); }}
            >
              {isSittingOut ? 'Rejoin Round' : 'Sit Out This Round'}
            </SecondaryButton>
          </div>
        </div>
      )}
    </>
  );
}
```

Key changes vs. the previous version:
- New `isProfileEdit?: boolean` prop
- New `persistCharacter()` helper centralizes the optimistic write — branches on `isProfileEdit`
- `autoSave` and `runLookup` no longer return early on missing `discordId` when `isProfileEdit` is true; they still gate Firestore writes on `discordId`
- Successful and failed lookups in profile-edit mode update `currentCharacter.lookupStatus`
- `saveStoredDiscordId` import added so we can persist the Discord ID hint when a profile edit happens to know the Discord ID

- [ ] **Step 2: Verify typecheck**

Run: `npm -w activity run typecheck`
Expected: No errors.

- [ ] **Step 3: Verify build**

Run: `npm -w activity run build`
Expected: Build succeeds.

- [ ] **Step 4: Run all unit tests**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && npx -w activity vitest run --project=unit`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/RoleEditor.tsx
git commit -m "feat(activity): RoleEditor supports profile-edit mode"
```

---

### Task 10: ProfileModal embeds RoleEditor + HeaderProfileSlot wired

**Files:**
- Modify: `activity/src/components/ProfileModal.tsx`
- Modify: `activity/src/components/HeaderProfileSlot.tsx`
- Modify: `activity/src/components/ProfileModal.stories.tsx`

- [ ] **Step 1: Update ProfileModal to embed RoleEditor inline**

Replace the contents of `activity/src/components/ProfileModal.tsx`:

```typescript
import { useMemo } from 'react';
import { useAppStore } from '../store/store';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';
import { RoleEditor } from './RoleEditor';
import { Divider } from './ui';
import type { WoWPlayer } from '../types';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onOpenConnections: () => void;
}

/**
 * Build a "shim" WoWPlayer from currentCharacter so RoleEditor can run in
 * profile-edit mode. Used when there's no channelData entry for the user
 * (outside a voice channel, or before identity resolves).
 */
function buildShimPlayer(
  currentCharacter: ReturnType<typeof useAppStore.getState>['currentCharacter'],
  discordId: string | null,
  displayName: string,
): WoWPlayer {
  return {
    name: displayName,
    discordId: discordId ?? '',
    inGameName: currentCharacter?.inGameName ?? '',
    mainRole: null,
    offspecs: [],
    utilities: [],
    mediaUrl: currentCharacter?.mediaUrl ?? null,
    characterClass: currentCharacter?.characterClass ?? null,
  };
}

export function ProfileModal({ open, onClose, onOpenConnections }: ProfileModalProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const currentCharacter = useAppStore((s) => s.currentCharacter);
  const channelData = useAppStore((s) => s.channelData);

  // Prefer the real channelData player when available — that's the canonical
  // record for in-voice users (includes role state). Fall back to a shim
  // built from currentCharacter for outside-channel use.
  const channelPlayer = currentPlayerId && channelData
    ? channelData.players.find((p) => p.discordId === currentPlayerId)
    : null;

  const editPlayer = useMemo<WoWPlayer>(
    () => channelPlayer ?? buildShimPlayer(
      currentCharacter,
      currentPlayerId,
      currentPlayerName ?? currentCharacter?.inGameName?.split('-')[0] ?? 'You',
    ),
    [channelPlayer, currentCharacter, currentPlayerId, currentPlayerName],
  );

  if (!open) return null;

  // The avatar mirrors ProfileAvatar's lookup priority — slice first, channel second.
  const mediaUrl = currentCharacter?.mediaUrl ?? channelPlayer?.mediaUrl ?? null;
  const characterClass = currentCharacter?.characterClass ?? channelPlayer?.characterClass ?? null;
  const displayName = currentCharacter?.inGameName?.split('-')[0]
    ?? currentPlayerName
    ?? channelPlayer?.name
    ?? 'You';

  const proxied = remapImageUrl(toAvatarUrl(mediaUrl) ?? undefined);
  const ring = getClassColor(characterClass) ?? '#888';

  // Profile-edit mode: writes go through currentCharacter slice + localStorage
  // (always), and mirror to preferences only when discordId is non-empty.
  // channelData updates indirectly via the bot reading preferences when
  // refreshPlayers triggers.
  const isProfileEdit = !channelPlayer;

  return (
    <div className="profile-modal__backdrop" onClick={onClose}>
      <div
        className="profile-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Profile"
      >
        <div className="profile-modal__avatar" style={{ borderColor: ring }}>
          {proxied
            ? <img src={proxied} alt="" />
            : <span>{displayName.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="profile-modal__name">{displayName}</div>
        {currentPlayerId && (
          <div className="profile-modal__field">
            <span className="profile-modal__label">Discord ID</span>
            <span className="profile-modal__value">{currentPlayerId}</span>
          </div>
        )}

        <Divider />

        <div className="profile-modal__editor">
          <RoleEditor
            player={editPlayer}
            isProfileEdit={isProfileEdit}
            hideSitOut
          />
        </div>

        <button
          type="button"
          className="profile-modal__connections-link"
          onClick={onOpenConnections}
        >
          View Connections →
        </button>
        <button type="button" className="profile-modal__close" onClick={onClose} aria-label="Close">×</button>
      </div>
    </div>
  );
}
```

Notable changes:
- Embeds `RoleEditor` inline
- Builds a shim `WoWPlayer` when no `channelData` entry exists
- Always renders the modal content with edit access — no longer just read-only
- Removed the explicit "in-game name" field display (RoleEditor's input is the editor)

- [ ] **Step 2: Update HeaderProfileSlot — empty state still opens modal**

Replace the contents of `activity/src/components/HeaderProfileSlot.tsx`:

```typescript
import { useState } from 'react';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileModal } from './ProfileModal';
import { useAppStore } from '../store/store';

export function HeaderProfileSlot() {
  const [open, setOpen] = useState(false);
  const setView = useAppStore((s) => s.setView);

  return (
    <>
      <ProfileAvatar onClick={() => setOpen(true)} />
      <ProfileModal
        open={open}
        onClose={() => setOpen(false)}
        onOpenConnections={() => {
          setOpen(false);
          setView('connections');
        }}
      />
    </>
  );
}
```

(This file barely changes — `ProfileAvatar` is now always actionable, so no extra wiring needed. Verify content matches.)

- [ ] **Step 3: Update ProfileModal stories to cover edit mode and outside-channel state**

Replace the contents of `activity/src/components/ProfileModal.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withStore } from '../../.storybook/decorators';
import { mockChannelData } from '../lib/mockData';
import { ProfileModal } from './ProfileModal';

const meta = {
  title: 'Organisms/ProfileModal',
  component: ProfileModal,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onClose: fn(),
    onOpenConnections: fn(),
  },
} satisfies Meta<typeof ProfileModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoIdentity_Empty: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: null,
    currentPlayerName: null,
    identityResolved: false,
    channelData: null,
    currentCharacter: null,
  })],
};

export const OutsideChannel_HasCharacter: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: null,
    currentPlayerName: null,
    identityResolved: false,
    channelData: null,
    currentCharacter: {
      inGameName: 'Tytanium-Stormrage',
      region: 'us',
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/stormrage/1/1234567-inset.jpg',
      characterClass: 'Druid',
      lookupStatus: 'ok',
      lastUpdated: 1234567890,
    },
  })],
};

export const InsideChannel_LinkedCharacter: Story = {
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000007',
    currentPlayerName: 'Fourseven',
    identityResolved: true,
    channelData: mockChannelData,
    currentCharacter: null,
  })],
};

export const Closed: Story = {
  args: { open: false },
  decorators: [withStore({
    isDemoMode: true,
    currentPlayerId: '100000000000000007',
    currentPlayerName: 'Fourseven',
    identityResolved: true,
    channelData: mockChannelData,
  })],
};
```

- [ ] **Step 4: Add CSS for the editor block in the modal**

Run: `grep -n 'profile-modal' /Users/tylerholland/Dev/MythicPlusDiscordBot/activity/src/index.css | head -10`

Find the `.profile-modal` block. Add a sibling rule for the embedded editor block:

```css
.profile-modal__editor {
  width: 100%;
  margin: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

- [ ] **Step 5: Verify typecheck and build**

Run: `npm -w activity run typecheck`
Expected: No errors.

Run: `npm -w activity run build`
Expected: Build succeeds.

- [ ] **Step 6: Visual sanity check via Storybook**

Run: `npm -w activity run storybook`

Open `http://localhost:6006`, navigate to Organisms → ProfileModal. Confirm:
- `OutsideChannel_HasCharacter` shows the avatar, the in-game name input populated, and the role buttons
- `NoIdentity_Empty` shows the modal with empty state and edit affordances
- `InsideChannel_LinkedCharacter` matches the previous behavior

Stop Storybook (Ctrl+C).

- [ ] **Step 7: Commit**

```bash
git add activity/src/components/ProfileModal.tsx activity/src/components/HeaderProfileSlot.tsx activity/src/components/ProfileModal.stories.tsx activity/src/index.css
git commit -m "feat(activity): ProfileModal embeds RoleEditor for profile edits"
```

---

### Task 11: Visual snapshot regression — HeaderProfileSlot on Home view

**Files:**
- Modify: `activity/tests/visual.spec.ts`

- [ ] **Step 1: Inspect existing visual snapshot test patterns**

Run: `head -80 /Users/tylerholland/Dev/MythicPlusDiscordBot/activity/tests/visual.spec.ts`

Read the file to understand how routes are loaded for snapshots. The pattern probably uses a Playwright `page.goto` to a Storybook URL or to a demo-mode app URL, followed by `expect(page).toHaveScreenshot()`.

- [ ] **Step 2: Add a snapshot for the Home view's HeaderProfileSlot avatar**

If the visual.spec.ts uses Storybook URLs, add a story-driven snapshot at the bottom of the file targeting the `ProfileAvatar` `FromCurrentCharacter` story (which we added in Task 7):

```typescript
test('ProfileAvatar shows current character outside a channel', async ({ page }) => {
  await page.goto('/iframe.html?id=molecules-profileavatar--from-current-character&viewMode=story');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.profile-avatar')).toHaveScreenshot('profile-avatar-from-current-character.png');
});
```

If `visual.spec.ts` does not use Storybook URLs (e.g., it loads the live demo app), adapt the snapshot to navigate the demo to the home view with localStorage pre-populated. Use whichever approach matches the existing tests in the file.

- [ ] **Step 3: Generate the new screenshot**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && ./scripts/playwright-docker.sh --update-snapshots`

Expected: A new file at `activity/tests/__screenshots__/...profile-avatar-from-current-character.png`. Inspect it visually to confirm the avatar renders.

- [ ] **Step 4: Run the visual tests to confirm they pass**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && ./scripts/playwright-docker.sh visual.spec.ts`

Expected: All visual tests pass, including the new snapshot.

- [ ] **Step 5: Commit**

```bash
git add activity/tests/visual.spec.ts activity/tests/__screenshots__/
git commit -m "test(activity): visual snapshot for ProfileAvatar slice render"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full backend verification**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && ./scripts/verify-ts.sh`
Expected: lint + typecheck + tests pass.

- [ ] **Step 2: Run full frontend verification**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && ./scripts/verify-activity.sh`
Expected: typecheck + build + Storybook build + Playwright tests pass.

- [ ] **Step 3: Manual smoke test**

Start the dev server. Run: `npm -w activity run dev`

Open the app in two browser tabs:

Tab 1 (fresh): clear localStorage. Open. Verify:
- HeaderProfileSlot shows placeholder avatar
- Click → ProfileModal opens, RoleEditor visible with empty in-game name
- Type a valid name like `Tytanium-Stormrage` → after debounce, lookup runs, avatar updates, status: ok
- Close modal → top-right avatar shows the character
- Refresh page → avatar persists (localStorage hydration)

Tab 2 (legacy localStorage): set `localStorage.setItem('wheelson-player-some-guild', '12345')`, then refresh. Verify:
- The migration runs; `wheelson-discord-id` is now `12345`

Stop the dev server (Ctrl+C).

- [ ] **Step 4: Confirm no regressions on existing flows**

Visit a demo guild (`/?demo=1` or whatever the demo flag is). Verify:
- Channels list works
- Picking a channel + identity still works (you can still pick yourself)
- Lobby + spin still works
- Spin warning dialog shows the new "Character not found" section if any player has a typo'd inGameName

If anything breaks, debug with the systematic-debugging skill before claiming completion.

---

## Self-Review

**Spec coverage:**
- "Avatar loads on every view" → Task 7 (slice-driven render) + Task 10 (modal accessible from slot) ✓
- "Persists per-browser without Discord ID" → Task 1 (helpers) + Task 2 (slice) + Task 3 (boot hydrate) ✓
- "Editing reachable from any view via avatar" → Task 7 (always actionable) + Task 10 (modal embeds editor) ✓
- "Pre-spin warning for missing mediaUrl" → Task 4 (bucket) + Task 5 (dialog) + Task 6 (lobby wire) ✓
- "Discord ID linkage opportunistic" → Task 8 (sync helper, mirror on resolve) ✓
- "One-shot hydrate from channelData" → Task 8 (`syncCharacterAcrossLayers` no-current-character branch) ✓
- "Migration of legacy keys" → Task 1 + Task 3 ✓
- "Components touched" matches the file structure section ✓
- "Testing" notes (unit, story, snapshot) → Tasks 1, 4, 5, 7, 10, 11 ✓

**Placeholder scan:** No "TBD" / "implement later" / generic error-handling phrasing in any task. Each step has concrete code or commands.

**Type consistency:**
- `StoredCharacter` defined in Task 1, used in Tasks 2, 8, 9, 10 — same shape throughout
- `setCurrentCharacter` signature is `(character: StoredCharacter | null) => void` — used consistently
- `categorizeUnreadyPlayers` returns three buckets with names `missingRole` / `missingNameOnly` / `missingCharacterLookup` — same names in roles.ts, SpinWarningDialog props, and LobbyView destructure
- `loadStoredDiscordId()` / `saveStoredDiscordId()` / `loadStoredCharacter()` / `saveStoredCharacter()` / `clearStoredCharacter()` / `migrateLegacyDiscordId()` — exported as named functions in Task 1, imported by name in Tasks 2, 3, 8, 9
- `isProfileEdit?: boolean` prop name on RoleEditor — used in Task 9 definition and Task 10 callsite
