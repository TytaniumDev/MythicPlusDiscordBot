# Lobby Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ambiguous lobby onboarding with a mandatory three-screen guided flow: Identity → Setup → Lobby.

**Architecture:** Add two new views (`IdentityView`, `SetupView`) gated before the existing `LobbyView`. Extract the role editing UI from `PlayerCard` into a shared `RoleEditor` component reused across `SetupView`, `PlayerCard`, and a new `EditPlayerModal`. Add readiness tracking (derived from WoW name + main role) and a spin warning dialog.

**Tech Stack:** React, TypeScript, Zustand, Firebase/Firestore, Playwright (E2E tests)

**Spec:** `docs/superpowers/specs/2026-03-25-lobby-flow-redesign.md`

---

### Task 1: Add readiness helpers and expand ViewName type

**Files:**
- Modify: `activity/src/lib/roles.ts`
- Modify: `activity/src/store/types.ts`

- [ ] **Step 1: Add `isPlayerReady` helper to `roles.ts`**

Add at the end of the utility functions section (after `hasAnyRole`):

```typescript
// activity/src/lib/roles.ts — add after hasAnyRole (line 11)

/** A player is "ready" when they have a WoW name and a main role. */
export function isPlayerReady(p: WoWPlayer): boolean {
  return !!p.inGameName && p.mainRole !== null;
}

/** Count ready players from a list, excluding sitting-out players. */
export function getReadyCount(players: WoWPlayer[], sittingOut: string[]): { ready: number; total: number } {
  const active = players.filter(p => !p.discordId || !sittingOut.includes(p.discordId));
  const ready = active.filter(isPlayerReady).length;
  return { ready, total: active.length };
}

/** Categorize unready players for the spin warning dialog. */
export function categorizeUnreadyPlayers(players: WoWPlayer[], sittingOut: string[]): {
  missingRole: WoWPlayer[];
  missingNameOnly: WoWPlayer[];
} {
  const active = players.filter(p => !p.discordId || !sittingOut.includes(p.discordId));
  const missingRole = active.filter(p => p.mainRole === null);
  const missingNameOnly = active.filter(p => p.mainRole !== null && !p.inGameName);
  return { missingRole, missingNameOnly };
}
```

- [ ] **Step 2: Expand ViewName type**

In `activity/src/store/types.ts`, update the ViewName type:

```typescript
// Change line 8 from:
export type ViewName = 'home' | 'channels' | 'lobby' | 'wheels' | 'results';
// To:
export type ViewName = 'home' | 'channels' | 'identity' | 'setup' | 'lobby' | 'wheels' | 'results';
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: PASS (no components reference the new views yet)

- [ ] **Step 4: Commit**

```bash
git add activity/src/lib/roles.ts activity/src/store/types.ts
git commit -m "feat: add readiness helpers and expand ViewName for lobby flow redesign"
```

---

### Task 2: Extract RoleEditor from PlayerCard

**Files:**
- Create: `activity/src/components/RoleEditor.tsx`
- Modify: `activity/src/components/PlayerCard.tsx`

This is a pure refactor — extract the role editing section (name input, main spec, offspec, utilities) into a standalone component. `PlayerCard` becomes a thin wrapper.

- [ ] **Step 1: Create `RoleEditor.tsx`**

```typescript
// activity/src/components/RoleEditor.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useCharacterLookup } from '../hooks/useCharacterLookup';
import { CharacterSearchInput } from './ui';
import {
  playerRolesToStringArray,
  roleStringsToPlayerFields,
  computeToggledRoles,
  MAIN_SPEC_BUTTONS,
  OFFSPEC_BUTTONS,
  UTILITY_BUTTONS,
  type RoleButtonDef,
} from '../lib/roles';
import type { RaiderioCharacterResult } from '../services/raiderioService';

interface RoleEditorProps {
  player: WoWPlayer;
  /** Called when the player's mediaUrl changes (e.g. after character lookup). */
  onMediaUrlChange?: (url: string | null) => void;
  /** If true, hide the sit-out button. Used in SetupView where sit-out doesn't apply. */
  hideSitOut?: boolean;
}

export function RoleEditor({ player, onMediaUrlChange, hideSitOut }: RoleEditorProps) {
  const sittingOut = useAppStore((s) => s.channelData?.sittingOut) ?? [];
  const service = useSessionService();

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [inGameName, setInGameName] = useState('');

  const { lookup, loading: lookupLoading } = useCharacterLookup();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rolesRef = useRef<Set<string>>(new Set());
  const nameRef = useRef<string>('');

  const playerId = player.discordId ?? null;

  useEffect(() => {
    const roles = new Set(playerRolesToStringArray(player));
    setSelectedRoles(roles);
    rolesRef.current = roles;
    setInGameName(player.inGameName ?? '');
    nameRef.current = player.inGameName ?? '';
  }, [playerId, player]);

  const autoSave = useCallback((roles: Set<string>, name: string) => {
    if (!player.discordId) return;

    const id = player.discordId;
    queueMicrotask(() => {
      const fields = roleStringsToPlayerFields(roles);
      useAppStore.getState().updatePlayer(id, { ...fields, inGameName: name || undefined });
    });

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        await service.saveRoles(player.discordId!, player.name, Array.from(roles), name);
        const store = useAppStore.getState();
        if (!store.identityResolved && player.discordId === store.currentPlayerId) {
          store.setIdentity(player.discordId!, player.name);
          store.setIdentityResolved(true);
          const guildId = store.currentGuildId;
          localStorage.setItem(`wheelson-player-${guildId ?? 'unknown'}`, player.discordId!);
        }
      } catch (err) {
        console.error('[Wheelson] Auto-save failed:', err);
      }
    }, 500);
  }, [player.discordId, player.name, service]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
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
    autoSave(rolesRef.current, value);
  }, [autoSave]);

  const handleCharacterSelect = useCallback(async (result: RaiderioCharacterResult) => {
    if (lookupLoading || !player.discordId) return;

    const character = await lookup(result.name, result.realmSlug, result.region);
    if (character) {
      setInGameName(character.name);
      nameRef.current = character.name;
      if (character.mediaUrl) onMediaUrlChange?.(character.mediaUrl);

      await service.saveLinkedCharacter(player.discordId, {
        name: result.name,
        realm: result.realmSlug,
        region: result.region,
      }, character.mediaUrl);

      const currentRoles = playerRolesToStringArray(player);
      if (currentRoles.length === 0) {
        const roles: string[] = [];
        if (character.role === 'tank') roles.push('Tank');
        else if (character.role === 'healer') roles.push('Healer');
        else if (character.role === 'ranged') roles.push('Ranged');
        else if (character.role === 'melee') roles.push('Melee');
        for (const u of character.utilities) {
          if (u === 'brez') roles.push('Brez');
          if (u === 'lust') roles.push('Lust');
        }
        const roleSet = new Set(roles);
        setSelectedRoles(roleSet);
        rolesRef.current = roleSet;
        await service.saveRoles(player.discordId, player.name, roles, character.name);
      } else {
        await service.saveRoles(player.discordId, player.name, Array.from(selectedRoles), character.name);
      }
    }
  }, [lookupLoading, player, lookup, selectedRoles, service, onMediaUrlChange]);

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
            >
              {btnDef.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="role-editor" data-testid="role-editor">
      <div className="role-editor-section">
        <div className="role-editor-label">In-Game Name</div>
        <div className="role-editor-row">
          <CharacterSearchInput
            value={inGameName}
            onChange={handleNameChange}
            onSelect={handleCharacterSelect}
            loading={lookupLoading}
          />
        </div>
      </div>

      {renderSection('Main Spec (pick one)', MAIN_SPEC_BUTTONS, true)}
      {renderSection('Offspec', OFFSPEC_BUTTONS, false)}
      {renderSection('Utilities', UTILITY_BUTTONS, false)}

      {!hideSitOut && (
        <div className="role-editor-section" style={{ marginTop: 4 }}>
          <div className="role-editor-row">
            <button
              className={`secondary-btn player-card__sit-out ${isSittingOut ? 'active-sitting-out' : ''}`}
              onClick={() => { if (player.discordId) service.toggleSitOut(player.discordId); }}
            >
              {isSittingOut ? 'Rejoin Round' : 'Sit Out This Round'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `PlayerCard` to use `RoleEditor`**

Replace the contents of `activity/src/components/PlayerCard.tsx`:

```typescript
// activity/src/components/PlayerCard.tsx
import { useState, useEffect } from 'react';
import { WoWPlayer } from '../types';
import { getPrimaryRole } from '../lib/roles';
import { CharacterHeader } from './CharacterHeader';
import { Divider } from './ui';
import { RoleEditor } from './RoleEditor';

const ROLE_COLOR_MAP: Record<string, string> = {
  tank: 'var(--color-tank)',
  healer: 'var(--color-healer)',
  ranged: 'var(--color-dps)',
  melee: 'var(--color-dps)',
  unassigned: 'var(--text-secondary)',
};

interface PlayerCardProps {
  player: WoWPlayer;
  className?: string;
}

export function PlayerCard({ player, className = '' }: PlayerCardProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const playerId = player.discordId ?? null;

  useEffect(() => {
    setMediaUrl(player.mediaUrl ?? null);
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const primaryRole = getPrimaryRole(player);
  const color = ROLE_COLOR_MAP[primaryRole] ?? ROLE_COLOR_MAP.unassigned;
  const classSubtitle = player.inGameName || undefined;

  return (
    <div className={`player-card ${className}`} data-testid="player-card">
      <CharacterHeader
        name={player.name}
        subtitle={classSubtitle}
        color={color}
        imageUrl={mediaUrl}
      />
      <Divider />
      <div className="player-card__form">
        <RoleEditor player={player} onMediaUrlChange={setMediaUrl} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Run Playwright tests to verify no regressions**

Run: `./scripts/playwright-docker.sh`
Expected: All existing tests PASS (this was a pure refactor)

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/RoleEditor.tsx activity/src/components/PlayerCard.tsx
git commit -m "refactor: extract RoleEditor from PlayerCard for reuse"
```

---

### Task 3: Update routing infrastructure

**Files:**
- Modify: `activity/src/lib/routing.ts`
- Modify: `activity/src/store/store.ts`

- [ ] **Step 1: Add identity/setup routes to `routing.ts`**

```typescript
// activity/src/lib/routing.ts — full replacement
import type { ViewName } from '../store/types';

export function statusToView(status: string): ViewName {
  switch (status) {
    case 'lobby':
    case 'request_spin':
      return 'lobby';
    case 'spinning':
      return 'wheels';
    case 'completed':
      return 'results';
    default:
      console.warn('[Wheelson] Unknown channel status:', status);
      return 'lobby';
  }
}

export function routeToView(hash: string): { view: ViewName; guildId: string | null } {
  if (!hash || hash === '#/') return { view: 'home', guildId: null };
  const match = hash.match(/^#\/guild\/([\w-]+)\/(channels|identity|setup|lobby|wheels|results)$/);
  if (match) return { view: match[2] as ViewName, guildId: match[1] };
  return { view: 'home', guildId: null };
}

export function viewToRoute(view: ViewName, guildId?: string | null): string {
  if (view === 'home' || !guildId) return '#/';
  return `#/guild/${guildId}/${view}`;
}
```

- [ ] **Step 2: Add `isSetupComplete` derived check to store utilities**

No store changes needed — `isSetupComplete` will be computed inline in the routing logic using `isPlayerReady()` from `lib/roles.ts`. The store already has `identityResolved`, `currentPlayerId`, and `channelData.players` which is sufficient.

- [ ] **Step 3: Verify typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add activity/src/lib/routing.ts
git commit -m "feat: add identity/setup routes to routing infrastructure"
```

---

### Task 4: Create IdentityView

**Files:**
- Create: `activity/src/views/IdentityView.tsx`

- [ ] **Step 1: Create `IdentityView.tsx`**

```typescript
// activity/src/views/IdentityView.tsx
import { useState } from 'react';
import { useAppStore } from '../store/store';
import { useIdentity } from '../hooks/useIdentity';
import { HeaderBar } from '../components/HeaderBar';
import { PrimaryCTA } from '../components/ui';
import type { WoWPlayer } from '../types';

interface IdentityViewProps {
  onNavigate: (view: 'channels' | 'setup' | 'home', opts?: { replace?: boolean }) => void;
}

export function IdentityView({ onNavigate }: IdentityViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const claimedPlayers = channelData?.claimedPlayers ?? [];
  const players = channelData?.players ?? [];
  const { selectPlayer } = useIdentity();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (player: WoWPlayer) => {
    if (!player.discordId) return;
    // Don't allow selecting already-claimed players
    if (claimedPlayers.includes(player.discordId)) return;
    setSelectedId(player.discordId);
  };

  const handleContinue = () => {
    const player = players.find(p => p.discordId === selectedId);
    if (!player) return;
    selectPlayer(player);
    onNavigate('setup', { replace: true });
  };

  if (players.length === 0) {
    return (
      <div className="main-layout">
        <HeaderBar
          title="Wheelson"
          subtitle="Join the voice channel to get started"
          onBack={() => onNavigate('channels')}
          onTitleClick={() => onNavigate('home')}
          className="app-header"
        />
        <main className="content-area">
          <section id="view-identity" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Waiting for players to join voice...</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="main-layout">
      <HeaderBar
        title="Wheelson"
        subtitle={`${players.length} in voice`}
        onBack={() => onNavigate('channels')}
        onTitleClick={() => onNavigate('home')}
        className="app-header"
      />
      <main className="content-area">
        <section id="view-identity">
          <div className="identity-picker">
            <h2 className="identity-picker__title">Select Your Name</h2>
            <p className="identity-picker__subtitle">Pick yourself from the voice channel</p>

            <div className="identity-grid">
              {players.map((player) => {
                const id = player.discordId ?? player.name;
                const isClaimed = player.discordId != null && claimedPlayers.includes(player.discordId);
                const isSelected = player.discordId === selectedId;

                return (
                  <button
                    key={id}
                    className={`identity-card${isSelected ? ' identity-card--selected' : ''}${isClaimed ? ' identity-card--claimed' : ''}`}
                    onClick={() => handleSelect(player)}
                    disabled={isClaimed}
                    aria-label={isClaimed ? `${player.name} (already claimed)` : `Select ${player.name}`}
                  >
                    <div className="identity-card__avatar">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="identity-card__name">{player.name}</span>
                    {isSelected && <span className="identity-card__check">✓</span>}
                    {isClaimed && <span className="identity-card__claimed">Claimed</span>}
                  </button>
                );
              })}
            </div>

            <PrimaryCTA
              id="identity-continue-btn"
              disabled={!selectedId}
              onClick={handleContinue}
            >
              Continue →
            </PrimaryCTA>
            <p className="identity-picker__help">
              Not in the list? Join the voice channel first.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for identity view**

Add to `activity/src/index.css` (at end of file, in the existing views section):

```css
/* ── Identity View ────────────────────────────────── */
.identity-picker {
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem;
  text-align: center;
}
.identity-picker__title {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}
.identity-picker__subtitle {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin: 0 0 1.5rem;
}
.identity-picker__help {
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-top: 0.75rem;
}
.identity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  text-align: left;
}
.identity-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color 0.15s, background 0.15s;
}
.identity-card:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--bg-hover);
}
.identity-card--selected {
  border-color: var(--accent);
  background: var(--accent-bg);
}
.identity-card--claimed {
  opacity: 0.4;
  cursor: not-allowed;
}
.identity-card__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}
.identity-card__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
}
.identity-card__check {
  margin-left: auto;
  color: var(--accent);
  flex-shrink: 0;
}
.identity-card__claimed {
  margin-left: auto;
  font-size: 0.65rem;
  opacity: 0.6;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add activity/src/views/IdentityView.tsx activity/src/index.css
git commit -m "feat: add IdentityView for player self-identification"
```

---

### Task 5: Create SetupView

**Files:**
- Create: `activity/src/views/SetupView.tsx`

- [ ] **Step 1: Create `SetupView.tsx`**

```typescript
// activity/src/views/SetupView.tsx
import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { HeaderBar } from '../components/HeaderBar';
import { CharacterHeader } from '../components/CharacterHeader';
import { Divider } from '../components/ui';
import { RoleEditor } from '../components/RoleEditor';
import { getPrimaryRole, isPlayerReady } from '../lib/roles';
import { PrimaryCTA } from '../components/ui';

const ROLE_COLOR_MAP: Record<string, string> = {
  tank: 'var(--color-tank)',
  healer: 'var(--color-healer)',
  ranged: 'var(--color-dps)',
  melee: 'var(--color-dps)',
  unassigned: 'var(--text-secondary)',
};

interface SetupViewProps {
  onNavigate: (view: 'identity' | 'lobby' | 'home', opts?: { replace?: boolean }) => void;
}

export function SetupView({ onNavigate }: SetupViewProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const channelData = useAppStore((s) => s.channelData);
  const players = channelData?.players ?? [];

  const player = useMemo(
    () => players.find(p => p.discordId === currentPlayerId) ?? null,
    [players, currentPlayerId],
  );

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    setMediaUrl(player?.mediaUrl ?? null);
  }, [player?.discordId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!player) {
    // Player not found (left voice?) — go back to identity
    return (
      <div className="main-layout">
        <HeaderBar
          title="Setup"
          subtitle="Player not found"
          onBack={() => onNavigate('identity')}
          onTitleClick={() => onNavigate('home')}
          className="app-header"
        />
        <main className="content-area">
          <section id="view-setup" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Your player was not found in the voice channel.
            </p>
            <button
              className="secondary-btn"
              style={{ marginTop: '1rem' }}
              onClick={() => onNavigate('identity')}
            >
              Go Back
            </button>
          </section>
        </main>
      </div>
    );
  }

  const primaryRole = getPrimaryRole(player);
  const color = ROLE_COLOR_MAP[primaryRole] ?? ROLE_COLOR_MAP.unassigned;
  const ready = isPlayerReady(player);

  return (
    <div className="main-layout">
      <HeaderBar
        title="Setup"
        subtitle="Set up your character"
        onBack={() => onNavigate('identity')}
        onTitleClick={() => onNavigate('home')}
        className="app-header"
      />
      <main className="content-area">
        <section id="view-setup">
          <div className="setup-view">
            <CharacterHeader
              name={player.name}
              subtitle={player.inGameName || undefined}
              color={color}
              imageUrl={mediaUrl}
            />
            <Divider />
            <div className="setup-view__form">
              <RoleEditor
                player={player}
                onMediaUrlChange={setMediaUrl}
                hideSitOut
              />
            </div>
            <PrimaryCTA
              id="setup-ready-btn"
              disabled={!ready}
              onClick={() => onNavigate('lobby', { replace: true })}
            >
              {ready ? "I'm Ready →" : 'Enter WoW name & pick a role'}
            </PrimaryCTA>
          </div>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for setup view**

Add to `activity/src/index.css`:

```css
/* ── Setup View ───────────────────────────────────── */
.setup-view {
  max-width: 420px;
  margin: 0 auto;
  padding: 1rem;
}
.setup-view__form {
  padding: 0.5rem 0;
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add activity/src/views/SetupView.tsx activity/src/index.css
git commit -m "feat: add SetupView for guided character setup"
```

---

### Task 6: Wire up routing in App.tsx and main.tsx

**Files:**
- Modify: `activity/src/App.tsx`
- Modify: `activity/src/main.tsx`

- [ ] **Step 1: Update App.tsx to render new views and handle routing**

Add imports and view rendering. The key logic: when navigating to `lobby`, check if identity is resolved and setup is complete. If not, redirect to the appropriate screen.

```typescript
// activity/src/App.tsx — updated imports (add IdentityView, SetupView, isPlayerReady)
import { IdentityView } from './views/IdentityView';
import { SetupView } from './views/SetupView';
import { isPlayerReady } from './lib/roles';
```

In the `navigateTo` callback, add identity/setup gate logic. Replace the existing `if (view === 'lobby') { store.resetSpinState(); }` block with:

```typescript
    // Gate lobby behind identity + setup
    if (view === 'lobby') {
      store.resetSpinState();
      // Try localStorage resolution if identity isn't resolved yet
      if (!store.identityResolved) {
        const guildId = store.currentGuildId;
        const savedId = localStorage.getItem(`wheelson-player-${guildId ?? 'unknown'}`);
        const players = store.channelData?.players ?? [];
        const match = savedId ? players.find(p => p.discordId === savedId) : null;
        if (match) {
          // Returning player — resolve identity from localStorage
          store.setIdentity(match.discordId ?? null, match.name);
          store.setIdentityResolved(true);
          // Check if setup is complete
          if (!isPlayerReady(match)) {
            view = 'setup' as ViewName;
          }
          // else: stay on lobby (fully set up returning player)
        } else {
          view = 'identity' as ViewName;
        }
      } else {
        const me = store.channelData?.players?.find(p => p.discordId === store.currentPlayerId);
        if (me && !isPlayerReady(me)) {
          view = 'setup' as ViewName;
        }
      }
    }
```

**Important:** This inline localStorage check replaces the need for `useIdentityResolver` in `LobbyView`. Since the user explicitly does not want auto-identification, the old `useIdentityResolver` hook (which called Discord SDK's `getParticipants()`) should NOT be used. Identity is resolved either through the picker (Screen 1) or localStorage. Remove the `useIdentityResolver` import from `LobbyView` (Task 9 already does this).

In the `popstate` handler (around line 93-108), add the same gate:

```typescript
      if (view === 'lobby') {
        const s2 = useAppStore.getState();
        if (!s2.identityResolved) {
          const guildId = s2.currentGuildId;
          const savedId = localStorage.getItem(`wheelson-player-${guildId ?? 'unknown'}`);
          const players = s2.channelData?.players ?? [];
          const match = savedId ? players.find(p => p.discordId === savedId) : null;
          if (match) {
            s2.setIdentity(match.discordId ?? null, match.name);
            s2.setIdentityResolved(true);
            if (!isPlayerReady(match)) {
              view = 'setup' as ViewName;
              history.replaceState({ view }, '', viewToRoute(view, s2.currentGuildId));
            }
          } else {
            view = 'identity' as ViewName;
            history.replaceState({ view }, '', viewToRoute(view, s2.currentGuildId));
          }
        } else {
          const me = s2.channelData?.players?.find(p => p.discordId === s2.currentPlayerId);
          if (me && !isPlayerReady(me)) {
            view = 'setup' as ViewName;
            history.replaceState({ view }, '', viewToRoute(view, s2.currentGuildId));
          }
        }
      }
```

Add the new views to the render block (after line 123, before `{currentView === 'lobby'...}`):

```typescript
      {currentView === 'identity' && <IdentityView onNavigate={navigateTo} />}
      {currentView === 'setup' && <SetupView onNavigate={navigateTo} />}
```

- [ ] **Step 2: Update `main.tsx` to respect identity state on init**

In the `statusToView` result handling (lines 38-42), after setting channelData, add an identity/setup check for non-test paths. The `?data=` path already handles identity injection at line 44-48, so only the normal init path (lines 64-110) needs updating.

After line 100 (`store.setView('channels');`), the view is set to 'channels' which will navigate to lobby once channel data arrives. The auto-navigate in `App.tsx` (line 68-74) will handle the identity gate when status is 'lobby'. No changes needed in main.tsx — the gate in `App.tsx` and `navigateTo` covers it.

However, for the `?data=` path, we need to respect the identity gate. Update lines 37-42:

```typescript
      } else {
        const cd = data as ChannelData;
        store.setChannelData(cd);
        // If identity is injected, use statusToView; otherwise gate to identity
        if (data.identity) {
          const view = statusToView(cd.status);
          store.setView(view);
        } else {
          const view = statusToView(cd.status);
          // For lobby status, show identity view unless identity is already resolved
          store.setView(view === 'lobby' ? 'identity' : view);
        }
      }
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Verify with dev server**

Run: `cd activity && npm run dev`
Open the app — should see identity view when navigating to a channel.

- [ ] **Step 5: Commit**

```bash
git add activity/src/App.tsx activity/src/main.tsx
git commit -m "feat: wire up identity/setup routing with lobby gate"
```

---

### Task 7: Update PlayerChip ready indicators

**Files:**
- Modify: `activity/src/components/PlayerChip.tsx`

- [ ] **Step 1: Change checkmark from "claimed" to "ready"**

Replace the `PlayerChip` component to use `isPlayerReady` instead of `claimedPlayers`:

```typescript
// activity/src/components/PlayerChip.tsx — updated
import { WoWPlayer } from '../types';
import { getPrimaryRole, formatRoleName, getRoleTags, isPlayerReady } from '../lib/roles';
import { useAppStore } from '../store/store';

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

interface PlayerChipProps {
  player: WoWPlayer;
}

export function PlayerChip({ player }: PlayerChipProps) {
  const sittingOut = useAppStore((s) => s.channelData?.sittingOut) ?? [];
  const roleKey = getPrimaryRole(player);
  const roleName = formatRoleName(roleKey);
  const tags = getRoleTags(player);

  const activePlayer = useAppStore((s) => s.activePlayer);
  const isSelected = activePlayer != null && player.discordId === activePlayer.discordId;
  const isSittingOut = player.discordId != null && sittingOut.includes(player.discordId);
  const ready = isPlayerReady(player);

  const handleClick = () => {
    useAppStore.getState().setActivePlayer(player);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`player-chip${isSelected ? ' is-selected' : ''}${isSittingOut ? ' sitting-out' : ''}${!ready && !isSittingOut ? ' not-ready' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${player.name} roles`}
    >
      {ready && <ReadyIcon />}
      {!ready && !isSittingOut && <NotReadyIcon />}
      <div className="chip-header">
        <span
          className={`role-dot ${roleKey}`}
          role="img"
          aria-label={roleName}
          title={roleName}
        />
        <span>{player.name}</span>
      </div>
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
  );
}
```

- [ ] **Step 2: Add CSS for ready/not-ready states**

Add to `activity/src/index.css`:

```css
/* ── PlayerChip ready states ──────────────────────── */
.player-chip .ready-check {
  color: var(--color-healer);
}
.player-chip .not-ready-x {
  color: var(--color-error, #ef4444);
  opacity: 0.6;
}
.player-chip.not-ready {
  opacity: 0.6;
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add activity/src/components/PlayerChip.tsx activity/src/index.css
git commit -m "feat: change PlayerChip checkmark from claimed to ready indicator"
```

---

### Task 8: Create EditPlayerModal

**Files:**
- Create: `activity/src/components/EditPlayerModal.tsx`

- [ ] **Step 1: Create `EditPlayerModal.tsx`**

```typescript
// activity/src/components/EditPlayerModal.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { WoWPlayer } from '../types';
import { getPrimaryRole } from '../lib/roles';
import { CharacterHeader } from './CharacterHeader';
import { Divider } from './ui';
import { RoleEditor } from './RoleEditor';

const ROLE_COLOR_MAP: Record<string, string> = {
  tank: 'var(--color-tank)',
  healer: 'var(--color-healer)',
  ranged: 'var(--color-dps)',
  melee: 'var(--color-dps)',
  unassigned: 'var(--text-secondary)',
};

interface EditPlayerModalProps {
  player: WoWPlayer;
  onClose: () => void;
}

export function EditPlayerModal({ player, onClose }: EditPlayerModalProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMediaUrl(player.mediaUrl ?? null);
  }, [player.discordId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const primaryRole = getPrimaryRole(player);
  const color = ROLE_COLOR_MAP[primaryRole] ?? ROLE_COLOR_MAP.unassigned;

  return (
    <div className="edit-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="edit-modal" role="dialog" aria-label={`Edit ${player.name}`}>
        <button className="edit-modal__close" onClick={onClose} aria-label="Close">✕</button>
        <CharacterHeader
          name={player.name}
          subtitle={player.inGameName || undefined}
          color={color}
          imageUrl={mediaUrl}
        />
        <Divider />
        <div className="edit-modal__form">
          <RoleEditor player={player} onMediaUrlChange={setMediaUrl} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for the modal**

Add to `activity/src/index.css`:

```css
/* ── Edit Player Modal ────────────────────────────── */
.edit-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}
.edit-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  width: 100%;
  max-width: 400px;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  padding: 1rem;
}
.edit-modal__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}
.edit-modal__close:hover {
  color: var(--text-primary);
}
.edit-modal__form {
  padding: 0.5rem 0;
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add activity/src/components/EditPlayerModal.tsx activity/src/index.css
git commit -m "feat: add EditPlayerModal for editing other players' roles"
```

---

### Task 9: Update LobbyView with ready counter, pinned card, and modal

**Files:**
- Modify: `activity/src/views/LobbyView.tsx`

- [ ] **Step 1: Update LobbyView**

Key changes:
1. Add ready counter to header subtitle
2. Pin PlayerCard to current user (sidebar/drawer always shows you)
3. Clicking another player's chip opens `EditPlayerModal`
4. Clicking your own chip scrolls/focuses your PlayerCard

```typescript
// activity/src/views/LobbyView.tsx — full replacement
import { useState, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { PlayerChip } from '../components/PlayerChip';
import { PlayerCard } from '../components/PlayerCard';
import { EditPlayerModal } from '../components/EditPlayerModal';
import { AffixBar } from '../components/AffixBar';
import { HeaderBar } from '../components/HeaderBar';
import { PrimaryCTA, RoleSectionHeader } from '../components/ui';
import { CollapsibleRoleSection } from '../components/CollapsibleRoleSection';
import { getPrimaryRole, hasAnyRole, getReadyCount } from '../lib/roles';
import { useIsMobileLobby } from '../hooks/useMediaQuery';
import { MobilePlayerDrawer } from '../components/MobilePlayerDrawer';

const SpinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

interface LobbyViewProps {
  onNavigate: (view: 'channels' | 'wheels' | 'home', opts?: { replace?: boolean }) => void;
}

export function LobbyView({ onNavigate }: LobbyViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const service = useSessionService();
  const players = channelData?.players || [];

  const isMobile = useIsMobileLobby();
  const [isCalculating, setIsCalculating] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<typeof players[number] | null>(null);

  const handleSpin = async () => {
    try {
      setIsCalculating(true);
      if (useAppStore.getState().isDemoMode) {
        onNavigate('wheels');
      }
      await service.requestSpin();
    } catch {
      useAppStore.getState().setStatusMessage('Spin request failed. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  const sittingOut = channelData?.sittingOut ?? [];
  const activePlayers = players.filter(p => !p.discordId || !sittingOut.includes(p.discordId));
  const sittingOutPlayers = players.filter(p => p.discordId && sittingOut.includes(p.discordId));

  const tanks = activePlayers.filter((p) => getPrimaryRole(p) === 'tank');
  const healers = activePlayers.filter((p) => getPrimaryRole(p) === 'healer');
  const rangedPlayers = activePlayers.filter((p) => getPrimaryRole(p) === 'ranged');
  const meleePlayers = activePlayers.filter((p) => getPrimaryRole(p) === 'melee');
  const unassigned = activePlayers.filter((p) => !hasAnyRole(p));

  // Pinned player card: always show "you"
  const myPlayer = useMemo(
    () => players.find(p => p.discordId === currentPlayerId) ?? null,
    [players, currentPlayerId],
  );

  // Handle chip clicks: self → focus card, others → open modal
  const handleChipClick = (player: typeof players[number]) => {
    if (player.discordId === currentPlayerId) {
      // On desktop, the sidebar is always showing your card.
      // On mobile, set activePlayer to trigger the drawer.
      useAppStore.getState().setActivePlayer(player);
    } else {
      // Open modal for other players
      setEditingPlayer(player);
    }
  };

  // Ready counter
  const { ready, total } = getReadyCount(players, sittingOut);
  const allReady = ready === total && total > 0;

  const playerCountText = players.length === 0
    ? '0 players'
    : activePlayers.length === 1
      ? '1 player'
      : `${activePlayers.length} players`;

  const readyText = `${ready}/${total} Ready`;

  const subtitleParts = [playerCountText];
  if (sittingOutPlayers.length > 0) subtitleParts.push(`${sittingOutPlayers.length} sitting out`);
  const subtitleText = subtitleParts.join(' · ');

  // Override PlayerChip click behavior by wrapping
  const renderChip = (p: typeof players[number]) => (
    <div key={p.discordId || p.name} onClick={(e) => { e.stopPropagation(); handleChipClick(p); }}>
      <PlayerChip player={p} />
    </div>
  );

  if (players.length === 0) {
    return (
      <div className="main-layout">
        <HeaderBar
          title="Players"
          subtitle="0 players"
          onBack={() => onNavigate('channels')}
          onTitleClick={() => onNavigate('home')}
          className="app-header"
          subtitleId="player-count"
        />
        <AffixBar />
        <main className="content-area">
          <section id="view-lobby">
            <div id="player-list">
              <div style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center' }}>
                Waiting for players to join voice...
              </div>
            </div>
            <PrimaryCTA id="spin-btn" disabled>
              Waiting for players...
            </PrimaryCTA>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={`main-layout${isMobile ? ' mobile-lobby' : ''}`}>
      <HeaderBar
        title="Players"
        subtitle={subtitleText}
        onBack={() => onNavigate('channels')}
        onTitleClick={() => onNavigate('home')}
        className="app-header"
        subtitleId="player-count"
        extra={
          <span className={`ready-badge ${allReady ? 'ready-badge--all' : 'ready-badge--partial'}`}>
            {readyText}
          </span>
        }
      />
      <AffixBar />
      <main className="content-area">
        <section id="view-lobby">

          <div className="lobby-body">
            <div className="lobby-players">
              <div id="player-list">
                <div className="role-column">
                  <div className="role-section">
                    <CollapsibleRoleSection label="Tanks" count={tanks.length} color="tank">
                      {tanks.map(renderChip)}
                    </CollapsibleRoleSection>
                  </div>
                  <div className="role-section">
                    <CollapsibleRoleSection label="Heal" count={healers.length} color="healer">
                      {healers.map(renderChip)}
                    </CollapsibleRoleSection>
                  </div>
                </div>

                <div className="role-column role-column-dps">
                  <CollapsibleRoleSection label="Ranged" count={rangedPlayers.length} color="dps">
                    <div className="dps-grid">
                      {rangedPlayers.map(renderChip)}
                    </div>
                  </CollapsibleRoleSection>
                  <CollapsibleRoleSection label="Melee" count={meleePlayers.length} color="dps">
                    <div className="dps-grid">
                      {meleePlayers.map(renderChip)}
                    </div>
                  </CollapsibleRoleSection>
                </div>

                {unassigned.length > 0 && (
                  <div className="role-section" style={{ gridColumn: '1 / -1' }}>
                    <RoleSectionHeader label="Unassigned" count={unassigned.length} color="unassigned" />
                    <div className="dps-grid">
                      {unassigned.map(renderChip)}
                    </div>
                  </div>
                )}

                {sittingOutPlayers.length > 0 && (
                  <div className="role-section" style={{ gridColumn: '1 / -1' }}>
                    <RoleSectionHeader label="Sitting Out" count={sittingOutPlayers.length} color="sitting-out" />
                    <div className="sitting-out-grid">
                      {sittingOutPlayers.map(renderChip)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!isMobile && myPlayer && (
              <div className="lobby-sidebar">
                <PlayerCard player={myPlayer} />
              </div>
            )}
          </div>

          {!isMobile && (
            <PrimaryCTA
              id="spin-btn"
              icon={<SpinIcon />}
              disabled={isCalculating}
              onClick={handleSpin}
            >
              {isCalculating ? 'Calculating...' : 'SPIN THE WHEEL!'}
            </PrimaryCTA>
          )}
        </section>
      </main>

      {isMobile && myPlayer && <MobilePlayerDrawer player={myPlayer} />}
      {isMobile && (
        <div className="mobile-spin-btn">
          <PrimaryCTA
            id="spin-btn"
            icon={<SpinIcon />}
            disabled={isCalculating}
            onClick={handleSpin}
          >
            {isCalculating ? 'Calculating...' : 'SPIN THE WHEEL!'}
          </PrimaryCTA>
        </div>
      )}

      {editingPlayer && (
        <EditPlayerModal
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: No changes needed to `HeaderBar`**

`HeaderBar` already has an `extra` prop (type `ReactNode`) rendered inside `.header-bar__right`. Use `extra` instead of `rightContent` in the LobbyView. Update the `<HeaderBar>` call in the LobbyView code above to use `extra=` instead of `rightContent=`.

- [ ] **Step 3: Add CSS for ready badge**

Add to `activity/src/index.css`:

```css
/* ── Ready Badge ──────────────────────────────────── */
.ready-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 0.75rem;
  white-space: nowrap;
}
.ready-badge--all {
  background: rgba(34, 197, 94, 0.15);
  color: var(--color-healer);
}
.ready-badge--partial {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add activity/src/views/LobbyView.tsx activity/src/index.css
git commit -m "feat: update LobbyView with ready counter, pinned card, and edit modal"
```

---

### Task 10: Create SpinWarningDialog and integrate with spin flow

**Files:**
- Create: `activity/src/components/SpinWarningDialog.tsx`
- Modify: `activity/src/views/LobbyView.tsx`

- [ ] **Step 1: Create `SpinWarningDialog.tsx`**

```typescript
// activity/src/components/SpinWarningDialog.tsx
import { useEffect, useRef, useCallback } from 'react';
import { WoWPlayer } from '../types';
import { SecondaryButton, PrimaryCTA } from './ui';

interface SpinWarningDialogProps {
  missingRole: WoWPlayer[];
  missingNameOnly: WoWPlayer[];
  onGoBack: () => void;
  onSpinAnyway: () => void;
}

export function SpinWarningDialog({ missingRole, missingNameOnly, onGoBack, onSpinAnyway }: SpinWarningDialogProps) {
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
        <div className="spin-warning__icon">⚠️</div>
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

        <div className="spin-warning__actions">
          <SecondaryButton onClick={onGoBack}>Go Back</SecondaryButton>
          <PrimaryCTA id="spin-anyway-btn" onClick={onSpinAnyway}>Spin Anyway</PrimaryCTA>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for spin warning dialog**

Add to `activity/src/index.css`:

```css
/* ── Spin Warning Dialog ──────────────────────────── */
.spin-warning {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  width: 100%;
  max-width: 420px;
  padding: 1.5rem;
  text-align: center;
}
.spin-warning__icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}
.spin-warning__title {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}
.spin-warning__subtitle {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin: 0 0 1rem;
}
.spin-warning__section {
  border-radius: 0.5rem;
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.75rem;
  text-align: left;
}
.spin-warning__section--error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.15);
}
.spin-warning__section--warn {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.15);
}
.spin-warning__section-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
  font-weight: 600;
}
.spin-warning__section--error .spin-warning__section-label { color: #ef4444; }
.spin-warning__section--warn .spin-warning__section-label { color: #f59e0b; }
.spin-warning__player {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0;
  font-size: 0.85rem;
}
.spin-warning__reason {
  font-size: 0.7rem;
  opacity: 0.6;
}
.spin-warning__actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
}
.spin-warning__actions > * {
  flex: 1;
}
```

- [ ] **Step 3: Integrate warning dialog into LobbyView spin flow**

In `LobbyView.tsx`, add state and imports:

```typescript
import { SpinWarningDialog } from '../components/SpinWarningDialog';
import { categorizeUnreadyPlayers } from '../lib/roles';

// Add state:
const [showSpinWarning, setShowSpinWarning] = useState(false);
```

Replace `handleSpin` with a two-step flow:

```typescript
  const handleSpinClick = () => {
    const { missingRole, missingNameOnly } = categorizeUnreadyPlayers(players, sittingOut);
    if (missingRole.length > 0 || missingNameOnly.length > 0) {
      setShowSpinWarning(true);
    } else {
      doSpin();
    }
  };

  const doSpin = async () => {
    setShowSpinWarning(false);
    try {
      setIsCalculating(true);

      // Auto-sit-out players missing a role
      const { missingRole } = categorizeUnreadyPlayers(players, sittingOut);
      for (const p of missingRole) {
        if (p.discordId && !sittingOut.includes(p.discordId)) {
          await service.toggleSitOut(p.discordId);
        }
      }

      if (useAppStore.getState().isDemoMode) {
        onNavigate('wheels');
      }
      await service.requestSpin();
    } catch {
      useAppStore.getState().setStatusMessage('Spin request failed. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };
```

Update the spin button `onClick` from `handleSpin` to `handleSpinClick`.

Add the dialog render at the bottom (before closing `</div>`):

```typescript
      {showSpinWarning && (() => {
        const { missingRole, missingNameOnly } = categorizeUnreadyPlayers(players, sittingOut);
        return (
          <SpinWarningDialog
            missingRole={missingRole}
            missingNameOnly={missingNameOnly}
            onGoBack={() => setShowSpinWarning(false)}
            onSpinAnyway={doSpin}
          />
        );
      })()}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd activity && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add activity/src/components/SpinWarningDialog.tsx activity/src/views/LobbyView.tsx activity/src/index.css
git commit -m "feat: add SpinWarningDialog with auto-sit-out for roleless players"
```

---

### Task 11: Update Playwright tests

**Files:**
- Modify: `activity/tests/pages.spec.ts`
- Modify: `activity/tests/components.spec.ts`

Existing tests inject `?data=` with channel data but no identity. After the routing change, lobby tests will now show the identity view instead. Fix by injecting identity alongside the data.

- [ ] **Step 1: Update test data to include identity**

In `activity/tests/pages.spec.ts`, update `lobbyData`, `lobbySittingOutData`, and any other channel data that needs to land on the lobby view:

```typescript
// Update lobbyData to include identity (uses first player)
const lobbyData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
  identity: { id: mockPlayers[0].discordId, name: mockPlayers[0].name },
};

const lobbyEmptyData = {
  ...mockChannelData,
  status: 'lobby',
  players: [],
  identity: { id: 'test-user', name: 'TestUser' },
};

const lobbySittingOutData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
  sittingOut: [mockPlayers[5].discordId, mockPlayers[7].discordId],
  identity: { id: mockPlayers[0].discordId, name: mockPlayers[0].name },
};
```

Do the same for `components.spec.ts` — any test that loads lobby data needs the identity field.

- [ ] **Step 2: Add identity view screenshot tests**

Add to `pages.spec.ts` inside the `designViewportTests` function:

```typescript
    test('Identity View', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      const identityData = {
        ...mockChannelData,
        status: 'lobby',
        players: mockPlayers,
        // No identity — will show identity picker
      };
      await page.goto(`/?data=${encodeData(identityData)}`);
      await expect(page.locator('#view-identity')).toBeVisible();
      await expect(page).toHaveScreenshot(`identity-${viewport.width}x${viewport.height}.png`);
    });
```

- [ ] **Step 3: Add setup view screenshot tests**

```typescript
    test('Setup View', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      // Player with identity but missing inGameName to land on setup
      const setupPlayer = { ...mockPlayers[0], inGameName: undefined };
      const setupData = {
        ...mockChannelData,
        status: 'lobby',
        players: [setupPlayer, ...mockPlayers.slice(1)],
        identity: { id: setupPlayer.discordId, name: setupPlayer.name },
      };
      await page.goto(`/?data=${encodeData(setupData)}`);
      await expect(page.locator('#view-setup')).toBeVisible();
      await expect(page).toHaveScreenshot(`setup-${viewport.width}x${viewport.height}.png`);
    });
```

- [ ] **Step 4: Regenerate all screenshots**

Run: `./scripts/playwright-docker.sh --update-snapshots`
Expected: Screenshots regenerated for all viewports

- [ ] **Step 5: Run Playwright tests to verify**

Run: `./scripts/playwright-docker.sh`
Expected: All tests PASS with new screenshots

- [ ] **Step 6: Commit**

```bash
git add activity/tests/ activity/src/
git commit -m "test: update Playwright tests for lobby flow redesign"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `cd activity && npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run full lint**

Run: `npx eslint packages/ activity/`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Run backend verify script**

Run: `./scripts/verify-ts.sh`
Expected: PASS

- [ ] **Step 4: Run frontend verify script**

Run: `./scripts/verify-activity.sh`
Expected: PASS

- [ ] **Step 5: Manual smoke test with dev server**

Run: `cd activity && npm run dev`

Test the full flow:
1. Open app with no localStorage → identity picker appears
2. Select a player → setup view with role editor
3. Enter name + pick role → "I'm Ready" enables
4. Click "I'm Ready" → lobby with ready counter
5. Click another player's chip → modal opens
6. Close modal → your card unchanged
7. Reload page → skips to lobby (localStorage cached)

- [ ] **Step 6: Final commit if any fixups needed**
