# Lobby Flow Redesign

## Context

Every M+ night requires significant explanation to get players through the lobby setup. The current flow is ambiguous — identity claiming is optional, there's no guided setup, and there's no concept of "readiness." This redesign introduces a mandatory, guided onboarding flow that makes setup self-explanatory and eliminates the need for verbal hand-holding.

## Overview

Replace the current "land in lobby and figure it out" experience with a three-screen guided flow:

1. **Identity Screen** — mandatory "pick yourself" from voice channel
2. **Setup Screen** — enter WoW name, confirm roles
3. **Lobby** — existing lobby with readiness indicators and minor modifications

Returning players (with localStorage identity + saved preferences containing WoW name and main role) skip screens 1 & 2 and land directly in the lobby as "ready."

## Screen 1: Identity Picker

**Purpose:** Force every player to claim their Discord identity before seeing the lobby.

**Layout:**
- Full-screen view, no lobby visible behind it
- Title: "Select Your Name" with subtitle "Pick yourself from the voice channel"
- Responsive grid of player cards (`auto-fill, minmax(150px, 1fr)`) — 3 columns on desktop, 2 on mobile
- Each card shows Discord avatar initial + Discord display name
- Selected card gets highlighted border + checkmark
- "Continue →" button at bottom, disabled until a player is selected
- Helper text: "Not in the list? Join the voice channel first."

**Data source:** `channelData.players` array from Firestore (populated by bot from voice channel members).

**Persistence:** On selection, save `discordId` to `localStorage` key `wheelson-player-{guildId}`. On return visits, if the saved `discordId` is found in the current player list AND the player's Firestore preferences have a WoW name + main role, skip directly to the lobby.

**What happens to already-claimed players:** A player that someone else has already claimed should appear greyed out / disabled with a subtle "claimed" indicator, so two people don't pick the same name. Uses existing `claimedPlayers` array in Firestore.

**Edge case — claimed player leaves voice:** When the bot detects a voice state change and removes a player from the `players` array, their `discordId` should also be removed from `claimedPlayers`. This is already handled by the bot's `updateChannelPlayers()` which rewrites the full player list.

**Demo mode:** The identity and setup screens work the same way in demo mode, using `demoService` instead of Firestore. Mock player data is used for the identity picker.

## Screen 2: Character Setup

**Purpose:** Guided setup of WoW name and roles before entering the lobby. Player is "ready" when they have a WoW name and a main role set.

**Layout:** Mirrors the existing `PlayerCard` component layout:
- Header showing Discord name + avatar
- **In-Game Name** — text input with Raider.io character search (reuse `CharacterSearchInput`)
- **Main Spec (pick one)** — mutually exclusive buttons: Tank, Healer, Ranged, Melee
- **Offspec** — multi-select buttons: Tank, Healer, Ranged, Melee (separate row from main spec)
- **Utilities** — multi-select buttons: Brez, Lust (separate row)
- "I'm Ready →" button, enabled when WoW name + main role are set

**Role toggle logic:** Reuse `computeToggledRoles()` from `activity/src/lib/roles.ts` — the same swap behavior as the existing PlayerCard (e.g., clicking Melee main when you have Healer main auto-moves Healer to offspec).

**Auto-save:** Same 500ms debounce pattern as the existing PlayerCard. Writes to `preferences/{discordId}` and sets `refreshPlayers` flag.

**Pre-population:** If the player already has saved preferences (from a previous session), pre-fill all fields. If everything is already set (name + main role), the "I'm Ready →" button is immediately enabled — one tap to get to the lobby.

**Character lookup:** Reuse `useCharacterLookup()` hook. Selecting a Raider.io character auto-fills name, avatar, and (if no roles set) auto-populates role/utilities from the character data.

## Screen 3: Lobby (Modified)

**Purpose:** Existing lobby with readiness tracking and a separation between "your" card and editing others.

### Changes from current lobby

**1. Ready counter in header:**
- Add a badge next to player count: "8/12 Ready"
- Green when all ready, yellow/amber when some are not

**2. Player chip checkmarks repurposed:**
- Existing green checkmark on `PlayerChip` changes meaning from "claimed" to "ready" (has WoW name + main role)
- Unready players show a red ✗ or no checkmark, with reduced opacity

**3. PlayerCard pinned to you:**
- The sidebar (desktop) / drawer (mobile) `PlayerCard` always shows the current user's data
- Clicking your own chip in the lobby still opens/focuses your PlayerCard as today
- Full editing capability: change name, roles, offspecs, utilities, sit out

**4. Modal for editing other players:**
- Clicking another player's chip opens a **modal** (not the sidebar/drawer)
- Modal contains the same role editing component (`PlayerCard` internals) — In-Game Name, Main Spec, Offspec, Utilities, Sit Out toggle
- Closing the modal returns focus to the lobby; your PlayerCard remains unchanged
- Extract shared role editing UI into a reusable component (e.g., `RoleEditor`) used by both the PlayerCard sidebar and the modal

**5. Spin warning dialog:**
- When someone taps "Spin the Wheel" and not all active players are ready:
  - **Missing main role** → listed in red "Will be sat out" section. These players are auto-sat-out if user proceeds.
  - **Missing WoW name only (has role)** → listed in yellow "Missing WoW name" section. These players are included, shown by Discord name.
- Two buttons: "Go Back" and "Spin Anyway"
- If all active players are ready, no dialog — spin proceeds immediately

**6. Everything else stays the same:**
- Role-based grouping (Tanks, Healers, Ranged, Melee, Unassigned, Sitting Out)
- Affix bar
- Collapsible role sections
- Existing spin flow and animations

## Component Architecture

### New Components
- **`IdentityView`** — full-screen identity picker (Screen 1)
- **`SetupView`** — guided character setup (Screen 2)
- **`SpinWarningDialog`** — modal warning when spinning with unready players
- **`EditPlayerModal`** — modal wrapper for editing another player's roles

### Modified Components
- **`PlayerCard`** — extract role editing internals into a shared `RoleEditor` component
- **`RoleEditor`** (new, extracted) — shared role editing UI used by `PlayerCard`, `SetupView`, and `EditPlayerModal`
- **`PlayerChip`** — checkmark meaning changes from "claimed" to "ready"
- **`LobbyView`** — add ready counter to header, wire chip clicks to modal for non-self players
- **`App.tsx`** — add routing for `IdentityView` and `SetupView` before lobby

### Reused As-Is
- `computeToggledRoles()`, `roleStringsToPlayerFields()`, `playerRolesToStringArray()` from `lib/roles.ts`
- `CharacterSearchInput` component
- `useCharacterLookup()` hook
- `CharacterHeader` component
- Firestore service methods: `saveRoles()`, `toggleSitOut()`, `claimPlayer()`

## State Changes

### Zustand Store
- `currentView` gains two new values: `'identity'` and `'setup'` (inserted between `'channels'` and `'lobby'` in the flow)
- Routing logic uses two checks:
  1. `identityResolved` (boolean) — has the user claimed a Discord identity?
  2. `isSetupComplete` (derived) — does the claimed player have `inGameName` + `mainRole`?
- Flow: `!identityResolved` → identity screen, `identityResolved && !isSetupComplete` → setup screen, both true → lobby

### Firestore
- No schema changes needed. Existing fields are sufficient:
  - `claimedPlayers: string[]` — tracks who has claimed an identity
  - `sittingOut: string[]` — tracks who is sitting out
  - `players: WoWPlayerDict[]` — player data with roles
  - `preferences/{discordId}` — saved roles, WoW name

### Ready State (Derived)
- A player is "ready" when: `inGameName` is truthy AND `mainRole` is not null
- Computed client-side from the player data, not stored as a separate field
- Ready count = `activePlayers.filter(p => p.inGameName && p.mainRole).length`

## Routing Flow

```
Entry (GitHub Pages or Discord Activity)
  ↓
Check localStorage for saved identity
  ├─ Found + player in voice + has name & role → Lobby (skip screens 1 & 2)
  ├─ Found + player in voice + missing name or role → Setup Screen (skip screen 1)
  └─ Not found or player not in voice → Identity Screen
```

## Verification

1. **Identity flow:** Open the app fresh (clear localStorage) → see identity picker → pick a name → land on setup screen → fill in name + role → land in lobby with checkmark
2. **Returning player:** Reload the page → should skip to lobby if previously set up
3. **Edit another player:** In lobby, click someone else's chip → modal opens → change their role → modal closes → their chip updates in real-time
4. **Spin warning:** Set up some players but leave others without roles → hit Spin → warning shows with correct categorization → "Spin Anyway" auto-sits-out roleless players
5. **Sit out:** From your PlayerCard, sit out → chip moves to sitting out section → rejoin → chip moves back
6. **Responsive grid:** Identity screen with 15+ players → grid shows 3 columns on desktop, 2 on mobile
7. **Role toggle logic:** On setup screen, set Healer main + Melee offspec → click Melee main → Healer auto-moves to offspec
8. **Playwright E2E:** Run `./scripts/playwright-docker.sh` — existing tests should still pass (lobby view tests may need updates for new routing)
