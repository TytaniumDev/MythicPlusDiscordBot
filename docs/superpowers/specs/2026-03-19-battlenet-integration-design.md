# Battle.net API Integration — Design Spec

## Overview

Add two features to the Wheelson activity frontend:

1. **Character Auto-Fill** — Players search for their WoW character by name, and their role, utilities, and display info are auto-populated from Battle.net data.
2. **Weekly Affix Display** — A bar in the lobby header showing the current week's M+ affixes with keystone level ranges, community nicknames, and Wowhead links.

Both features use Firebase Cloud Functions as the backend, keeping the Discord bot untouched.

## Architecture: Firebase-First

All external API logic lives in a new `packages/functions/` workspace. The bot is not modified.

```
Frontend (activity/)
  ├── Raider.io search API (client-side, public, no auth)
  └── Firebase Cloud Functions
        ├── lookupCharacter (callable)
        └── fetchWeeklyAffixes (scheduled)
              └── Battle.net Game Data / Profile APIs (client_credentials OAuth)
```

### Why Firebase Functions over bot-side

- Frontend already consumes Firestore via `onSnapshot` — same pipeline
- Keeps API secrets in Firebase config, not the bot's environment
- Bot stays focused on Discord concerns
- Cloud Functions free tier (2M invocations/month) far exceeds our usage

## Feature 1: Character Auto-Fill

### User Flow

1. Player opens their identity card (formerly PlayerModal, becoming a standalone card — see Activity.pen for current design)
2. Player types in the In-Game Name field
3. After 2–3 characters (debounced 300ms), the frontend calls **Raider.io's public search API** directly (client-side, no Cloud Function needed)
4. An autocomplete dropdown appears below the field showing results: `CharacterName - Realm (Class)`
5. Player selects a result → frontend calls the `lookupCharacter` **Cloud Function** with `{ name, realm, region }`
6. Cloud Function returns character data → frontend pre-fills:
   - Identity card header: character name, class label, portrait (mediaUrl), role-colored dot
   - Form fields: `mainRole` and `utilities` set as defaults
7. **All fields autosave immediately** — no Save button. Selecting a character, changing a role, toggling an offspec — each change writes to Firestore on change.
8. Player can clear the linked character to search again, or manually type a name (for players not on Raider.io)

### Key Principle: API Data is a Suggestion

Everything the API populates is a **default that the player can override**. Players may be in the wrong spec, may not play certain aspects of their class, or may want to queue as a different role for this session. The API never overwrites a player's manually-set preferences.

- On first link: API data fills empty fields
- On returning sessions: the linked character refreshes display data (class, media) but preserves the player's saved role/offspec/utility choices

### Cloud Function: `lookupCharacter`

**Type:** Callable (invoked by frontend via Firebase SDK)

**Input:**
```typescript
{ name: string; realm: string; region: string }
```

**Output:**
```typescript
{
  name: string;         // "Tytanium"
  realm: string;        // "Stormrage"
  class: string;        // "Warrior"
  role: Role;           // "tank" — derived from active spec
  utilities: Utility[]; // ["brez"] — derived from class
  mediaUrl: string;     // character render URL from Battle.net
}
```

**Behavior:**
- Authenticates with Battle.net using `client_credentials` OAuth (client ID + secret from Firebase config)
- Calls Character Profile Summary, Character Specializations, and Character Media APIs
- Derives `role` from active spec (e.g. Protection → tank, Arms/Fury → melee)
- Derives `utilities` from class (DK/Druid → brez, Mage/Shaman/Evoker → lust, Hunter → both)
- Caches result in Firestore `characters/{region}-{realm}-{name}` with a **1-day TTL** to avoid redundant API calls
- On cache hit (within TTL), returns cached data without calling Battle.net

**Class → Utility Mapping:**
| Class | Utilities |
|-------|-----------|
| Death Knight | brez |
| Druid | brez |
| Warlock | brez |
| Paladin | brez |
| Mage | lust |
| Shaman | lust |
| Evoker | brez, lust |
| Hunter | brez, lust |
| All others | none |

**Spec → Role Mapping:**
Tank specs (Protection Warrior, Protection Paladin, Blood DK, Vengeance DH, Guardian Druid, Brewmaster Monk) → `"tank"`
Healer specs (Holy Priest, Discipline Priest, Restoration Druid, Restoration Shaman, Holy Paladin, Mistweaver Monk, Preservation Evoker) → `"healer"`
Ranged DPS specs (all Mage, Balance Druid, Shadow Priest, Elemental Shaman, all Warlock, Beast Mastery/Marksmanship Hunter, Devastation/Augmentation Evoker) → `"ranged"`
All other DPS specs → `"melee"`

### Client-Side: Raider.io Autocomplete

Called directly from the frontend (public API, no auth needed).

**Endpoint:** `https://raider.io/api/v1/search?search={query}&searchType=characters`

**Debounce:** 300ms after user stops typing, minimum 2–3 characters

**Dropdown item format:** `CharacterName - Realm (Class)`

### Data Persistence

- **Linked character identity** (`name`, `realm`, `region`) is saved alongside existing role preferences (by discordId) in the preference storage
- **Role/offspec/utility overrides** persist as they do today — API data only fills empty fields on first link
- **Autosave** on every field change (character selection, role toggle, offspec toggle, utility toggle, sit-out toggle)

## Feature 2: Weekly Affix Display

### User Experience

A horizontal bar between the lobby header ("Players" / count) and the role columns, showing all active affixes for the current week. Each affix displays:

- Color-coded dot
- Official affix name (clickable link to Wowhead)
- Keystone level range (monospace, e.g. `+4–11`)
- Community nickname where applicable (no nickname for well-known affixes like Fortified/Tyrannical)

See `Activity.pen` → frame "Weekly Affix Bar" in "Approach A" for the current visual design.

### Midnight Season 1 Affix System

| Keystone Level | Affix | Nickname | Color |
|---|---|---|---|
| +2–5 | Lindormi's Guidance | training wheels | green |
| +4–11 | Xal'atath's Bargain: _variant_ (rotates weekly) | see below | purple |
| +6 | Lindormi's Guidance removed | — | — |
| +7 | Tyrannical OR Fortified (alternates weekly) | — | red |
| +10 | Both Tyrannical AND Fortified | — | red |
| +12 | Xal'atath's Guile (replaces Bargain) | death penalty | gold |

**Xal'atath's Bargain variant nicknames:**
| Variant | Nickname | Core Mechanic |
|---|---|---|
| Ascendant | CC/interrupt | Stop orbs via interrupt, CC, purge |
| Voidbound | big add | Kill the Void Emissary before cast completes |
| Pulsar | soak | Absorb orbiting orbs before they expire |
| Devour | dispel | Heal or dispel shield debuffs on players |

**Wowhead links:**
- Lindormi's Guidance → `https://www.wowhead.com/affix=165/lindormis-guidance`
- Xal'atath's Bargain: Ascendant → `https://www.wowhead.com/affix=148/xalataths-bargain-ascendant`
- Xal'atath's Bargain: Voidbound → `https://www.wowhead.com/spell=463410/xalataths-bargain-voidbound`
- Xal'atath's Bargain: Pulsar → `https://www.wowhead.com/affix=162/xalataths-bargain-pulsar`
- Xal'atath's Bargain: Devour → `https://www.wowhead.com/spell=465051/xalataths-bargain-devour`
- Fortified → `https://www.wowhead.com/affix=10/fortified`
- Tyrannical → `https://www.wowhead.com/affix=9/tyrannical`
- Xal'atath's Guile → `https://www.wowhead.com/affix=147/xalataths-guile`

### Cloud Function: `fetchWeeklyAffixes`

**Type:** Scheduled (runs on weekly reset — Tuesdays 10:00 AM PT / 17:00 UTC)

**Behavior:**
- Authenticates with Battle.net via `client_credentials` OAuth
- Calls Mythic Keystone Period Index API to get the current period
- Calls Mythic Keystone Period API for the active affix set
- Maps API affix IDs to display data (name, nickname, keystone level, color, wowhead URL)
- Writes to Firestore doc: `config/affixes`

**Firestore document shape (`config/affixes`):**
```typescript
{
  period: number;
  region: string;
  lastUpdated: Timestamp;
  affixes: Array<{
    id: number;
    name: string;
    nickname: string | null;
    keystoneLevel: string;    // "+4–11", "+7", "+12"
    wowheadUrl: string;
    color: string;            // hex color for the dot
  }>;
}
```

### Frontend Integration

- Frontend subscribes to `config/affixes` via `onSnapshot` (same pattern as session data)
- Affix bar renders from the `affixes` array
- If `config/affixes` doesn't exist yet (first deploy, function hasn't run), the affix bar simply doesn't render — no error state needed
- Affixes update automatically when the scheduled function writes new data on weekly reset

## New Infrastructure

### `packages/functions/` workspace

New workspace in the monorepo containing Firebase Cloud Functions.

- TypeScript, compiled with the Firebase Functions SDK
- Dependencies: `firebase-functions`, `firebase-admin`, native `fetch` for API calls (matching the existing pattern in the bot)
- Environment secrets: `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET` stored in Firebase Functions config or Secret Manager

### Deployment

Cloud Functions deploy via `firebase deploy --only functions` (can be added to CI later, but manual deploy is fine initially).

## Changes by Package

| Package | Changes |
|---|---|
| `packages/functions/` | **New** — Cloud Functions for `lookupCharacter` and `fetchWeeklyAffixes` |
| `packages/shared/` | Add class→utility and spec→role mapping constants |
| `activity/` | Raider.io autocomplete in identity card, affix bar component, subscribe to `config/affixes` |
| `packages/bot/` | **No changes** |

## Out of Scope

- Battle.net OAuth login (authorization_code flow) — not needed since we use client_credentials + character name/realm
- M+ rating or iLvl display in the identity card — display-only data from the API, not persisted
- Dungeon suggestions based on player keystones — requires OAuth sign-in to see inventory
- Affix display in Discord embeds — could be added later as a bot command
