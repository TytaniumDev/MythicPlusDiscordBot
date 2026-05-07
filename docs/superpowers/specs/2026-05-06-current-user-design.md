# Persistent current-user character

Make the current user's WoW character a long-lived per-browser concept so the
top-right avatar loads on every view, no re-selection per guild, no Discord
sign-in. Decouples character data from Discord identity: many users never link
a Discord ID at all.

## Motivation

Today, "who am I" is computed afresh every time a user enters a guild's
activity. The localStorage cache `wheelson-player-{guildId}` is per-guild, so
each new server triggers the picker again. The HeaderProfileSlot only renders
when `channelData.players` contains the current user — meaning the top-right
avatar is empty on Home and Channels views, and on cold-boot before Firestore
responds.

The user's character data already persists in `preferences/{discordId}`, but
it's gated behind the picker flow and only readable through `channelData`. A
user opening Wheelson outside Discord, or in a fresh browser, sees nothing
about themselves until they pick again.

There's also no validation gate before spinning: a player with a typo'd
`inGameName-realm` ends up in the lobby with no avatar and no Raider.io score,
and the spin proceeds silently. The user reports this is the most common cause
of bad UX.

## Goals

- Avatar loads in the top-right slot wherever the user opens Wheelson — Home,
  Channels, and any view, with or without `channelData`.
- Character selection persists per-browser without requiring Discord ID.
- Editing the character is reachable from any view via the avatar.
- Pre-spin warning fires when any voice-channel player's character didn't
  resolve (no `mediaUrl`), with "Spin anyway" override.

## Non-goals

- No sign-in or OAuth flow. Discord ID linkage stays opportunistic.
- No multi-character ("alts") switcher. One character per browser is enough
  for v1.
- No cross-device sync of the local character. localStorage is per-browser.
  Cross-device users will set up their character once per browser.

## Architecture

### Storage layers

Three storage layers, in order of authority for the avatar/profile UI:

**1. Per-browser local character** — `wheelson-character` localStorage key.
Source of truth for the top-right avatar. Always present once a character is
set. No Discord ID required.

```ts
interface StoredCharacter {
  inGameName: string;       // "Tytanium-Stormrage"
  region: string;           // "us"
  mediaUrl: string | null;
  characterClass: CharacterClass | null;
  lookupStatus: 'pending' | 'ok' | 'not_found' | 'no_name';
  lastUpdated: number;      // epoch ms
}
```

**2. Discord ID hint** — `wheelson-discord-id` localStorage key. Optional.
Set when the voice-channel picker resolves the user. Used only to enable the
opportunistic Firestore mirror. Many users may never have this set.

Replaces the per-guild `wheelson-player-{guildId}` keys.

**3. Discord-side preferences** — `preferences/{discordId}` Firestore doc.
Unchanged shape. Now a sync target rather than a source of truth for the
avatar UI. The bot still reads this to populate `channelData.players` when a
voice-channel member has a Discord ID we know about.

### Store slice — `currentCharacter`

```ts
interface CurrentCharacter {
  inGameName: string;
  region: string;
  mediaUrl: string | null;
  characterClass: CharacterClass | null;
  lookupStatus: 'pending' | 'ok' | 'not_found' | 'no_name';
}
```

Lives on `useAppStore` next to the existing `currentPlayerId` /
`currentPlayerName` fields. Hydrated from `wheelson-character` on app boot
(synchronously, before first paint), updated by ProfileModal edits.

No `discordId` field on this slice — the Discord ID lives separately as
`currentPlayerId` (existing). The two are decoupled.

### Bootstrap on app launch

In `main.tsx`, before React renders:

1. Read `wheelson-character` → seed `currentCharacter` slice.
2. Read `wheelson-discord-id` → seed `currentPlayerId` slice.
3. (Migration) If `wheelson-discord-id` is absent and any
   `wheelson-player-{guildId}` keys exist, copy any one of them to
   `wheelson-discord-id`. Don't delete the old keys — they're harmless.

These reads are synchronous, so the avatar can render on first paint.

### HeaderProfileSlot — character first, channelData fallback

```
if (currentCharacter populated) → render avatar from currentCharacter
else if (channelData has current user) → render from channelData (legacy path)
else → render "Set up character" placeholder button
```

The placeholder, when tapped, opens ProfileModal in edit mode. This keeps the
slot always actionable.

The fallback to `channelData` is a transitional safety net for users who
already have `preferences/{discordId}` data but haven't opened ProfileModal
yet. It can be removed once we're confident every user has hydrated their
local character.

### ProfileModal — expanded with inline editor

Today, ProfileModal shows read-only character info plus a "View Connections"
link. The expanded version embeds the existing `RoleEditor` component
inline:

- Character header (avatar, name, class — sourced from `currentCharacter`)
- `RoleEditor` form (in-game name input + role/utility buttons)
- "View Connections" link (existing)

`RoleEditor` currently expects a real `WoWPlayer` from `channelData.players`.
We adapt it to also accept a "shim" player built from `currentCharacter` when
no channel context exists. The lookup-debounce / Battle.net fetch logic stays
unchanged.

**Write path:**

1. Call a new `setCurrentCharacter(...)` store action. The action does two
   things in one place: writes to `wheelson-character` localStorage AND
   updates the `currentCharacter` slice. The slice update triggers React
   rerender. localStorage is purely for persistence across reloads — there's
   no auto-subscription from localStorage to the slice.
2. **If** `currentPlayerId` is set (Discord ID known), mirror to
   `preferences/{discordId}` via the existing
   `firestoreService.saveLinkedCharacter` and `saveRoles` calls. Same calls
   as today, just gated on having a Discord ID.
3. If no Discord ID, write stays local-only.

This is the only behavioral split between linked and unlinked users — the UI
is identical.

### Voice-channel identity flow

Mostly unchanged. `useIdentity.resolveIdentity` continues to:
- Match localStorage Discord ID against current voice participants
- Fall back to participant-name matching
- Fall back to the IdentityView picker

Two changes:

1. The localStorage key it reads/writes is the new global
   `wheelson-discord-id` (not the per-guild key).
2. When the Discord ID first resolves in a session, run an opportunistic
   sync between localStorage and `preferences/{discordId}`:

   - If `currentCharacter` is empty AND the just-resolved player record in
     `channelData.players` has character data (`mediaUrl` or `inGameName`
     populated by the bot from a prior `preferences/{discordId}` entry),
     copy that record into `currentCharacter` and persist to
     `wheelson-character`. This is a one-shot hydrate so returning users
     who used Wheelson on this Discord account before don't have to
     re-enter their character on this browser.
   - If `currentCharacter` is populated, mirror it to
     `preferences/{discordId}` via `saveLinkedCharacter` + `saveRoles`.
     localStorage wins on conflict — the rationale is that ProfileModal is
     the user's most recent intentional edit. (Last-write-wins is fine for
     character data; conflicts are rare and the user can always re-edit.)
   - If both are empty, no-op — user will set up via ProfileModal.

This sync is fire-and-forget — failures don't surface to the user, since
the local character keeps working regardless. Runs once per session per
identity resolution; subsequent ProfileModal edits use the per-edit write
path described above.

### Spin gate

Extends `categorizeUnreadyPlayers` in `activity/src/lib/roles.ts` with a third
bucket:

```ts
{
  missingRole: WoWPlayer[],         // existing
  missingNameOnly: WoWPlayer[],     // existing
  missingCharacterLookup: WoWPlayer[], // NEW: name set but mediaUrl null
}
```

`SpinWarningDialog` gets a third section listing players with broken lookups
and a "Looks like a typo? `{inGameName}` didn't resolve. Edit to fix." hint.
"Spin anyway" override remains.

The check operates on `channelData.players` (the voice-channel roster), which
already pulls character data from `preferences/{discordId}` via the bot. Users
who never linked Discord ID won't have entries here for their character —
they'd appear in the bucket. The opportunistic mirror in the identity flow
addresses this for users who go through the picker.

There's a transient state to be aware of: between voice-channel join and the
first identity-mirror round-trip (picker resolves → mirror writes preferences
→ bot reload → channelData refresh), the current user's own entry in the
voice-channel roster may have no `mediaUrl`. They'd flag in the bucket for
their own session momentarily. The override remains, so this is a UX wart
rather than a correctness issue. We accept it for v1.

We don't gate on Raider.io score. Raider.io is best-effort — fetched async in
`useDungeonSuggestions`, with its own loading and error states. Blocking the
spin on it would flake during slow Raider.io responses.

## Components touched

| File | Change |
|------|--------|
| `activity/src/store/store.ts` | Add `currentCharacter` slice + setters |
| `activity/src/store/types.ts` | Add `CurrentCharacter` type to `AppState` |
| `activity/src/main.tsx` | Hydrate localStorage on boot (sync, pre-render) |
| `activity/src/hooks/useIdentity.ts` | Switch to global localStorage key; opportunistic mirror to preferences |
| `activity/src/components/ProfileAvatar.tsx` | Read from `currentCharacter` slice; show placeholder when empty |
| `activity/src/components/ProfileModal.tsx` | Embed `RoleEditor` inline; accept shim player when no channelData |
| `activity/src/components/HeaderProfileSlot.tsx` | Wire placeholder click to ProfileModal edit mode |
| `activity/src/components/RoleEditor.tsx` | Accept shim player; write to localStorage character; mirror to preferences when Discord ID known |
| `activity/src/lib/roles.ts` | Add `missingCharacterLookup` bucket to `categorizeUnreadyPlayers` |
| `activity/src/components/SpinWarningDialog.tsx` | Render new bucket section |
| `activity/src/views/LobbyView.tsx` | Pass new bucket into `SpinWarningDialog` |
| `activity/src/App.tsx` | Update `resolveLobbyGate` to use global localStorage key |

New files: none — every change extends existing components.

## Migration

`wheelson-player-{guildId}` keys → `wheelson-discord-id` global key.

In `main.tsx` boot sequence, before reading the new key:

```ts
if (!localStorage.getItem('wheelson-discord-id')) {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('wheelson-player-')) {
      const value = localStorage.getItem(key);
      if (value) {
        localStorage.setItem('wheelson-discord-id', value);
        break;
      }
    }
  }
}
```

Old keys stay in place — they're a few bytes each and not worth a cleanup
pass. The new code never reads or writes them; they're just leftover values.

`preferences/{discordId}` Firestore docs need no migration. Existing data is
read by the bot exactly as before.

## Testing

- Unit test for `categorizeUnreadyPlayers` new bucket (`activity/src/lib/rolesHelpers.test.ts`).
- Unit test for the localStorage migration helper.
- Storybook story for `ProfileModal` in edit mode, with and without
  `channelData`.
- Storybook story for `SpinWarningDialog` with the third bucket populated.
- Playwright snapshot for HeaderProfileSlot rendering on Home view (outside
  channel context) — visual regression for the "avatar everywhere" goal.
- Playwright flow: enter character via ProfileModal on Home → navigate to a
  channel → verify the lobby roster pulls the character via the
  opportunistic-mirror path.

## Out of scope / follow-ups

- Multi-character switcher (alts). One character per browser is enough for v1.
- A "Forget character" affordance in ProfileModal (clears localStorage). Easy
  to add but not in this design.
- Detection of character renames / deletions. The Battle.net lookup will
  return `not_found` and the user can re-enter; no auto-recovery needed.
- Cross-device sync. Users with multiple browsers do the picker once per
  browser. Out of scope without sign-in.
