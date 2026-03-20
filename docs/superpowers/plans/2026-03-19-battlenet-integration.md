# Battle.net API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add character auto-fill (via Raider.io search + Battle.net profile) and weekly affix display to the Wheelson activity frontend, powered by Firebase Cloud Functions.

**Architecture:** New `packages/functions/` workspace hosts two Cloud Functions: a scheduled `fetchWeeklyAffixes` that writes affix data to Firestore weekly, and a callable `lookupCharacter` that proxies Battle.net profile lookups with 1-day caching. The frontend calls Raider.io directly for autocomplete (public API) and reads all other data from Firestore. The Discord bot is not modified.

**Tech Stack:** Firebase Cloud Functions (TypeScript), Battle.net OAuth (client_credentials), Raider.io public API, React/Zustand frontend, Firestore real-time listeners.

**Spec:** `docs/superpowers/specs/2026-03-19-battlenet-integration-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `packages/functions/package.json` | Firebase Functions workspace config |
| `packages/functions/tsconfig.json` | TypeScript config for Cloud Functions |
| `packages/functions/src/index.ts` | Cloud Functions entry point (exports both functions) |
| `packages/functions/src/battlenet.ts` | Battle.net OAuth token management + API client |
| `packages/functions/src/fetchWeeklyAffixes.ts` | Scheduled function: fetch affixes, write to Firestore |
| `packages/functions/src/lookupCharacter.ts` | Callable function: character profile lookup with caching |
| `packages/functions/src/affixMetadata.ts` | Static affix display data (nicknames, colors, Wowhead URLs, keystone levels) |
| `packages/functions/tests/battlenet.test.ts` | Unit tests for Battle.net OAuth client |
| `packages/functions/tests/fetchWeeklyAffixes.test.ts` | Unit tests for affix fetching logic |
| `packages/functions/tests/lookupCharacter.test.ts` | Unit tests for character lookup + caching |
| `packages/shared/src/classData.ts` | Class→utility and spec→role mapping constants |
| `packages/shared/tests/classData.test.ts` | Unit tests for class/spec mappings |
| `activity/src/services/raiderioService.ts` | Client-side Raider.io character search |
| `activity/src/components/AffixBar.tsx` | Weekly affix display component |
| `activity/src/hooks/useAffixes.ts` | Hook: subscribe to `config/affixes` Firestore doc |
| `activity/src/hooks/useCharacterSearch.ts` | Hook: Raider.io autocomplete with debounce |
| `activity/src/hooks/useCharacterLookup.ts` | Hook: call `lookupCharacter` Cloud Function |

### Modified Files

| File | Changes |
|---|---|
| `package.json` (root) | Add `packages/functions` to workspaces |
| `firebase.json` | Add `functions` configuration |
| `activity/src/firebase.ts` | Add `getFunctions` import and export |
| `activity/src/services/firestoreService.ts` | Add `saveLinkedCharacter` method, fix `saveRoles` to use `{ merge: true }` |
| `activity/src/services/types.ts` | Add `saveLinkedCharacter` to `SessionService` interface |
| `activity/src/services/demoService.ts` | Add stub `saveLinkedCharacter` for demo mode |
| `activity/src/components/PlayerModal.tsx` | Integrate character search + autosave (or reference new card component from Pencil) |
| `activity/src/views/LobbyView.tsx` | Add `AffixBar` component |

---

## Task 1: Class/Spec Mapping Constants in Shared Package

**Files:**
- Create: `packages/shared/src/classData.ts`
- Create: `packages/shared/tests/classData.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing tests for class→utility mapping**

```typescript
// packages/shared/tests/classData.test.ts
import { describe, it, expect } from 'vitest';
import { getUtilitiesForClass, getRoleForSpec } from '../src/classData';

describe('getUtilitiesForClass', () => {
  it('returns brez for Death Knight', () => {
    expect(getUtilitiesForClass('Death Knight')).toEqual(['brez']);
  });

  it('returns brez for Druid', () => {
    expect(getUtilitiesForClass('Druid')).toEqual(['brez']);
  });

  it('returns brez for Warlock', () => {
    expect(getUtilitiesForClass('Warlock')).toEqual(['brez']);
  });

  it('returns brez for Paladin', () => {
    expect(getUtilitiesForClass('Paladin')).toEqual(['brez']);
  });

  it('returns lust for Mage', () => {
    expect(getUtilitiesForClass('Mage')).toEqual(['lust']);
  });

  it('returns lust for Shaman', () => {
    expect(getUtilitiesForClass('Shaman')).toEqual(['lust']);
  });

  it('returns lust for Evoker', () => {
    expect(getUtilitiesForClass('Evoker')).toEqual(['lust']);
  });

  it('returns brez and lust for Hunter', () => {
    expect(getUtilitiesForClass('Hunter')).toEqual(['brez', 'lust']);
  });

  it('returns empty for Rogue', () => {
    expect(getUtilitiesForClass('Rogue')).toEqual([]);
  });

  it('returns empty for unknown class', () => {
    expect(getUtilitiesForClass('Unknown')).toEqual([]);
  });
});
```

- [ ] **Step 1b: Add vitest to shared package**

The shared package doesn't have vitest yet. Add it as a devDependency and a test script:

In `packages/shared/package.json`, add:
```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
},
"devDependencies": {
  "vitest": "^3.2.1"
}
```

Then run: `npm install`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx -w packages/shared vitest run tests/classData.test.ts`
Expected: FAIL — module `../src/classData` not found

- [ ] **Step 3: Write failing tests for spec→role mapping**

Add to the same test file:

```typescript
describe('getRoleForSpec', () => {
  it('maps Protection Warrior to tank', () => {
    expect(getRoleForSpec('Protection', 'Warrior')).toBe('tank');
  });

  it('maps Blood to tank (Death Knight)', () => {
    expect(getRoleForSpec('Blood', 'Death Knight')).toBe('tank');
  });

  it('maps Holy Paladin to healer', () => {
    expect(getRoleForSpec('Holy', 'Paladin')).toBe('healer');
  });

  it('maps Restoration Druid to healer', () => {
    expect(getRoleForSpec('Restoration', 'Druid')).toBe('healer');
  });

  it('maps Frost Mage to ranged', () => {
    expect(getRoleForSpec('Frost', 'Mage')).toBe('ranged');
  });

  it('maps Shadow Priest to ranged', () => {
    expect(getRoleForSpec('Shadow', 'Priest')).toBe('ranged');
  });

  it('maps Augmentation Evoker to ranged', () => {
    expect(getRoleForSpec('Augmentation', 'Evoker')).toBe('ranged');
  });

  it('maps Arms Warrior to melee', () => {
    expect(getRoleForSpec('Arms', 'Warrior')).toBe('melee');
  });

  it('maps Survival Hunter to melee', () => {
    expect(getRoleForSpec('Survival', 'Hunter')).toBe('melee');
  });

  it('maps Havoc Demon Hunter to melee', () => {
    expect(getRoleForSpec('Havoc', 'Demon Hunter')).toBe('melee');
  });

  it('maps Frost Death Knight to melee (not ranged)', () => {
    expect(getRoleForSpec('Frost', 'Death Knight')).toBe('melee');
  });

  it('maps Devourer Demon Hunter to ranged', () => {
    expect(getRoleForSpec('Devourer', 'Demon Hunter')).toBe('ranged');
  });

  it('maps Frost Mage to ranged', () => {
    expect(getRoleForSpec('Frost', 'Mage')).toBe('ranged');
  });

  it('defaults unknown spec to melee', () => {
    expect(getRoleForSpec('Unknown', 'Unknown')).toBe('melee');
  });
});
```

- [ ] **Step 4: Implement classData.ts**

```typescript
// packages/shared/src/classData.ts
import type { Role, Utility } from './types';

const CLASS_UTILITIES: Record<string, Utility[]> = {
  'Death Knight': ['brez'],
  'Druid': ['brez'],
  'Warlock': ['brez'],
  'Paladin': ['brez'],
  'Mage': ['lust'],
  'Shaman': ['lust'],
  'Evoker': ['lust'],
  'Hunter': ['brez', 'lust'],
};

export function getUtilitiesForClass(className: string): Utility[] {
  return CLASS_UTILITIES[className] ?? [];
}

const TANK_SPECS = new Set([
  'Protection',  // Warrior, Paladin
  'Blood',       // Death Knight
  'Vengeance',   // Demon Hunter
  'Guardian',    // Druid
  'Brewmaster',  // Monk
]);

const HEALER_SPECS = new Set([
  'Holy',          // Priest, Paladin
  'Discipline',    // Priest
  'Restoration',   // Druid, Shaman
  'Mistweaver',    // Monk
  'Preservation',  // Evoker
]);

// Ranged specs mapped as class:spec to avoid ambiguity (Frost Mage = ranged, Frost DK = melee)
const RANGED_CLASS_SPECS = new Set([
  'Mage:Frost',
  'Mage:Fire',
  'Mage:Arcane',
  'Druid:Balance',
  'Priest:Shadow',
  'Shaman:Elemental',
  'Warlock:Affliction',
  'Warlock:Demonology',
  'Warlock:Destruction',
  'Hunter:Beast Mastery',
  'Hunter:Marksmanship',
  'Evoker:Devastation',
  'Evoker:Augmentation',
  'Demon Hunter:Devourer',
]);

export function getRoleForSpec(specName: string, className: string): Role {
  if (TANK_SPECS.has(specName)) return 'tank';
  if (HEALER_SPECS.has(specName)) return 'healer';
  if (RANGED_CLASS_SPECS.has(`${className}:${specName}`)) return 'ranged';
  return 'melee';
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx -w packages/shared vitest run tests/classData.test.ts`
Expected: all PASS

- [ ] **Step 6: Export from shared index**

Add to `packages/shared/src/index.ts`:
```typescript
export { getUtilitiesForClass, getRoleForSpec } from './classData.js';
```

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/classData.ts packages/shared/tests/classData.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add class→utility and spec→role mappings"
```

---

## Task 2: Firebase Cloud Functions Workspace Scaffold

**Files:**
- Create: `packages/functions/package.json`
- Create: `packages/functions/tsconfig.json`
- Create: `packages/functions/src/index.ts`
- Modify: `package.json` (root)
- Modify: `firebase.json`

- [ ] **Step 1: Create package.json for functions workspace**

```json
{
  "name": "@mythicplus/functions",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "deploy": "firebase deploy --only functions"
  },
  "dependencies": {
    "@mythicplus/shared": "*",
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.3.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^3.2.1"
  },
  "engines": {
    "node": "22"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create minimal index.ts entry point**

```typescript
// packages/functions/src/index.ts
// Cloud Functions entry point — exports are registered here
```

- [ ] **Step 4: Verify workspace resolution**

`packages/*` in root `package.json` already covers `packages/functions`. Verify by running:

```bash
npm ls --workspaces
```

Expected: `@mythicplus/functions` appears in the workspace list. No changes to root `package.json` needed.

- [ ] **Step 5: Update firebase.json with functions config**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": [
    {
      "source": "packages/functions",
      "codebase": "default",
      "runtime": "nodejs22"
    }
  ]
}
```

- [ ] **Step 6: Install dependencies**

Run: `cd /Users/tylerholland/Dev/MythicPlusDiscordBot && npm install`

- [ ] **Step 7: Verify typecheck**

Run: `npx -w packages/functions tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add packages/functions/package.json packages/functions/tsconfig.json packages/functions/src/index.ts firebase.json
git commit -m "feat(functions): scaffold Firebase Cloud Functions workspace"
```

---

## Task 3: Battle.net OAuth Client

**Files:**
- Create: `packages/functions/src/battlenet.ts`
- Create: `packages/functions/tests/battlenet.test.ts`

- [ ] **Step 1: Write failing tests for token fetching and API calls**

```typescript
// packages/functions/tests/battlenet.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleNetClient } from '../src/battlenet';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('BattleNetClient', () => {
  let client: BattleNetClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BattleNetClient('test-client-id', 'test-client-secret');
  });

  describe('getToken', () => {
    it('fetches a new token from Battle.net OAuth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'abc123', expires_in: 86400 }),
      });

      const token = await client.getToken();
      expect(token).toBe('abc123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth.battle.net/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('reuses cached token on subsequent calls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'abc123', expires_in: 86400 }),
      });

      await client.getToken();
      await client.getToken();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws on auth failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.getToken()).rejects.toThrow('Battle.net OAuth failed: 401');
    });
  });

  describe('getCharacterProfile', () => {
    it('fetches character profile from Battle.net API', async () => {
      // Token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'abc123', expires_in: 86400 }),
      });
      // Profile fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: 'Tytanium', character_class: { name: 'Warrior' } }),
      });

      const profile = await client.getCharacterProfile('us', 'stormrage', 'tytanium');
      expect(profile.name).toBe('Tytanium');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toContain('/profile/wow/character/stormrage/tytanium');
    });

    it('returns null when character is not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'abc123', expires_in: 86400 }),
      });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const profile = await client.getCharacterProfile('us', 'stormrage', 'nonexistent');
      expect(profile).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx -w packages/functions vitest run tests/battlenet.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Battle.net OAuth client**

```typescript
// packages/functions/src/battlenet.ts

const REGION_HOSTS: Record<string, string> = {
  us: 'us.api.blizzard.com',
  eu: 'eu.api.blizzard.com',
  kr: 'kr.api.blizzard.com',
  tw: 'tw.api.blizzard.com',
};

export class BattleNetClient {
  private token: string | null = null;
  private tokenExpiry = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch('https://oauth.battle.net/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Battle.net OAuth failed: ${response.status}`);
    }

    const data = await response.json();
    this.token = data.access_token;
    // Expire 5 minutes early to avoid edge cases
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
    return this.token!;
  }

  async apiCall(region: string, path: string): Promise<Response> {
    const token = await this.getToken();
    const host = REGION_HOSTS[region] ?? REGION_HOSTS.us;
    return fetch(`https://${host}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
  }

  async getCharacterProfile(region: string, realmSlug: string, characterName: string) {
    const response = await this.apiCall(
      region,
      `/profile/wow/character/${realmSlug}/${characterName.toLowerCase()}?namespace=profile-${region}&locale=en_US`,
    );
    if (!response.ok) return null;
    return response.json();
  }

  async getCharacterMedia(region: string, realmSlug: string, characterName: string) {
    const response = await this.apiCall(
      region,
      `/profile/wow/character/${realmSlug}/${characterName.toLowerCase()}/character-media?namespace=profile-${region}&locale=en_US`,
    );
    if (!response.ok) return null;
    return response.json();
  }

  async getCharacterSpecializations(region: string, realmSlug: string, characterName: string) {
    const response = await this.apiCall(
      region,
      `/profile/wow/character/${realmSlug}/${characterName.toLowerCase()}/specializations?namespace=profile-${region}&locale=en_US`,
    );
    if (!response.ok) return null;
    return response.json();
  }

  async getMythicKeystonePeriodIndex(region: string) {
    const response = await this.apiCall(
      region,
      `/data/wow/mythic-keystone/period/index?namespace=dynamic-${region}&locale=en_US`,
    );
    if (!response.ok) return null;
    return response.json();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx -w packages/functions vitest run tests/battlenet.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add packages/functions/src/battlenet.ts packages/functions/tests/battlenet.test.ts
git commit -m "feat(functions): add Battle.net OAuth client"
```

---

## Task 4: Affix Metadata & Scheduled Affix Function

**Files:**
- Create: `packages/functions/src/affixMetadata.ts`
- Create: `packages/functions/src/fetchWeeklyAffixes.ts`
- Create: `packages/functions/tests/fetchWeeklyAffixes.test.ts`
- Modify: `packages/functions/src/index.ts`

- [ ] **Step 1: Create affix metadata (static mapping)**

```typescript
// packages/functions/src/affixMetadata.ts

export interface AffixDisplay {
  id: number;
  name: string;
  nickname: string | null;
  keystoneLevel: string;
  wowheadUrl: string;
  color: string;
}

// Affixes that are always present (not weekly rotation)
export const STATIC_AFFIXES: AffixDisplay[] = [
  {
    id: 165,
    name: "Lindormi's Guidance",
    nickname: 'training wheels',
    keystoneLevel: '+2–5',
    wowheadUrl: 'https://www.wowhead.com/affix=165/lindormis-guidance',
    color: '#22c55e',
  },
  {
    id: 147,
    name: "Xal'atath's Guile",
    nickname: 'death penalty',
    keystoneLevel: '+12',
    wowheadUrl: 'https://www.wowhead.com/affix=147/xalataths-guile',
    color: '#f59e0b',
  },
];

// Weekly rotating Xal'atath's Bargain variants
export const BARGAIN_AFFIXES: Record<number, AffixDisplay> = {
  148: {
    id: 148,
    name: "Xal'atath's Bargain: Ascendant",
    nickname: 'CC/interrupt',
    keystoneLevel: '+4–11',
    wowheadUrl: 'https://www.wowhead.com/affix=148/xalataths-bargain-ascendant',
    color: '#a855f7',
  },
  158: {
    id: 158,
    name: "Xal'atath's Bargain: Voidbound",
    nickname: 'big add',
    keystoneLevel: '+4–11',
    wowheadUrl: 'https://www.wowhead.com/affix=158/xalataths-bargain-voidbound',
    color: '#a855f7',
  },
  162: {
    id: 162,
    name: "Xal'atath's Bargain: Pulsar",
    nickname: 'soak',
    keystoneLevel: '+4–11',
    wowheadUrl: 'https://www.wowhead.com/affix=162/xalataths-bargain-pulsar',
    color: '#a855f7',
  },
  160: {
    id: 160,
    name: "Xal'atath's Bargain: Devour",
    nickname: 'dispel',
    keystoneLevel: '+4–11',
    wowheadUrl: 'https://www.wowhead.com/affix=160/xalataths-bargain-devour',
    color: '#a855f7',
  },
};

// Weekly rotating Fortified/Tyrannical
export const FORT_TYRAN_AFFIXES: Record<number, AffixDisplay> = {
  10: {
    id: 10,
    name: 'Fortified',
    nickname: null,
    keystoneLevel: '+7',
    wowheadUrl: 'https://www.wowhead.com/affix=10/fortified',
    color: '#ef4444',
  },
  9: {
    id: 9,
    name: 'Tyrannical',
    nickname: null,
    keystoneLevel: '+7',
    wowheadUrl: 'https://www.wowhead.com/affix=9/tyrannical',
    color: '#ef4444',
  },
};

export function resolveAffixDisplay(affixId: number): AffixDisplay | null {
  return STATIC_AFFIXES.find(a => a.id === affixId)
    ?? BARGAIN_AFFIXES[affixId]
    ?? FORT_TYRAN_AFFIXES[affixId]
    ?? null;
}
```

- [ ] **Step 2: Write failing tests for the scheduled function logic**

```typescript
// packages/functions/tests/fetchWeeklyAffixes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAffixDocument } from '../src/fetchWeeklyAffixes';

describe('buildAffixDocument', () => {
  it('maps Battle.net period response to affix display data', () => {
    // Simulated Battle.net response: Devour + Fortified week
    const periodData = {
      id: 1000,
      affix_details: [
        { id: 160, name: "Xal'atath's Bargain: Devour" },
        { id: 10, name: 'Fortified' },
        { id: 165, name: "Lindormi's Guidance" },
        { id: 147, name: "Xal'atath's Guile" },
      ],
    };

    const result = buildAffixDocument(periodData, 'us');

    expect(result.period).toBe(1000);
    expect(result.region).toBe('us');
    expect(result.affixes).toHaveLength(4);
    expect(result.affixes[0]).toMatchObject({
      id: 165,
      name: "Lindormi's Guidance",
      nickname: 'training wheels',
      keystoneLevel: '+2–5',
    });
    // Bargain variant
    const devour = result.affixes.find(a => a.id === 160);
    expect(devour).toMatchObject({
      nickname: 'dispel',
      keystoneLevel: '+4–11',
      color: '#a855f7',
    });
  });

  it('skips unknown affix IDs', () => {
    const periodData = {
      id: 1000,
      affix_details: [
        { id: 99999, name: 'Unknown Affix' },
        { id: 10, name: 'Fortified' },
      ],
    };

    const result = buildAffixDocument(periodData, 'us');
    expect(result.affixes).toHaveLength(1);
    expect(result.affixes[0].id).toBe(10);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx -w packages/functions vitest run tests/fetchWeeklyAffixes.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement fetchWeeklyAffixes**

```typescript
// packages/functions/src/fetchWeeklyAffixes.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { BattleNetClient } from './battlenet';
import { resolveAffixDisplay, type AffixDisplay } from './affixMetadata';
import { defineSecret } from 'firebase-functions/params';

const bnetClientId = defineSecret('BNET_CLIENT_ID');
const bnetClientSecret = defineSecret('BNET_CLIENT_SECRET');

export interface AffixDocument {
  period: number;
  region: string;
  lastUpdated: FieldValue | Date;
  affixes: AffixDisplay[];
}

// Pure logic — testable without Firebase
export function buildAffixDocument(
  periodData: { id: number; affix_details: Array<{ id: number; name: string }> },
  region: string,
): Omit<AffixDocument, 'lastUpdated'> & { lastUpdated: Date } {
  const affixes: AffixDisplay[] = [];

  for (const affix of periodData.affix_details) {
    const display = resolveAffixDisplay(affix.id);
    if (display) affixes.push(display);
  }

  // Sort by keystone level appearance: Lindormi's (+2) → Bargain (+4) → Fort/Tyran (+7) → Guile (+12)
  const SORT_ORDER: Record<number, number> = { 165: 0, 147: 3, 10: 2, 9: 2 };
  // Bargain variants all get order 1
  Object.keys(BARGAIN_AFFIXES).forEach(id => { SORT_ORDER[Number(id)] = 1; });
  affixes.sort((a, b) => (SORT_ORDER[a.id] ?? 99) - (SORT_ORDER[b.id] ?? 99));

  return {
    period: periodData.id,
    region,
    lastUpdated: new Date(),
    affixes,
  };
}

// Firebase Cloud Function
export const fetchWeeklyAffixes = onSchedule(
  {
    schedule: 'every tuesday 17:00',
    timeZone: 'UTC',
    secrets: [bnetClientId, bnetClientSecret],
  },
  async () => {
    const client = new BattleNetClient(bnetClientId.value(), bnetClientSecret.value());
    const region = 'us';

    // Get current period
    const periodIndex = await client.getMythicKeystonePeriodIndex(region);
    if (!periodIndex) throw new Error('Failed to fetch period index');

    const currentPeriodId = periodIndex.current_period.id;

    // Get period details (contains active affixes)
    const periodResponse = await client.apiCall(
      region,
      `/data/wow/mythic-keystone/period/${currentPeriodId}?namespace=dynamic-${region}&locale=en_US`,
    );
    if (!periodResponse.ok) throw new Error(`Failed to fetch period ${currentPeriodId}`);
    const periodData = await periodResponse.json();

    const doc = buildAffixDocument(periodData, region);

    const db = getFirestore();
    await db.doc('config/affixes').set({
      ...doc,
      lastUpdated: FieldValue.serverTimestamp(),
    });
  },
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx -w packages/functions vitest run tests/fetchWeeklyAffixes.test.ts`
Expected: all PASS

- [ ] **Step 6: Export from index.ts**

Update `packages/functions/src/index.ts`:

```typescript
import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { fetchWeeklyAffixes } from './fetchWeeklyAffixes';
```

- [ ] **Step 7: Commit**

```bash
git add packages/functions/src/affixMetadata.ts packages/functions/src/fetchWeeklyAffixes.ts packages/functions/tests/fetchWeeklyAffixes.test.ts packages/functions/src/index.ts
git commit -m "feat(functions): add weekly affix fetch scheduled function"
```

---

## Task 5: Character Lookup Callable Function

**Files:**
- Create: `packages/functions/src/lookupCharacter.ts`
- Create: `packages/functions/tests/lookupCharacter.test.ts`
- Modify: `packages/functions/src/index.ts`

- [ ] **Step 1: Write failing tests for character lookup logic**

```typescript
// packages/functions/tests/lookupCharacter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCharacterResult } from '../src/lookupCharacter';

describe('buildCharacterResult', () => {
  it('builds result from Battle.net profile and spec data', () => {
    const profile = {
      name: 'Tytanium',
      realm: { slug: 'stormrage', name: 'Stormrage' },
      character_class: { name: 'Warrior' },
      active_specialization: { name: 'Protection' },
    };
    const media = {
      assets: [{ key: 'main-raw', value: 'https://render.worldofwarcraft.com/us/character/main-raw.png' }],
    };

    const result = buildCharacterResult(profile, media);

    expect(result).toEqual({
      name: 'Tytanium',
      realm: 'Stormrage',
      class: 'Warrior',
      role: 'tank',
      utilities: ['brez'],
      mediaUrl: 'https://render.worldofwarcraft.com/us/character/main-raw.png',
    });
  });

  it('returns null mediaUrl when media response is null', () => {
    const profile = {
      name: 'Firemage',
      realm: { slug: 'illidan', name: 'Illidan' },
      character_class: { name: 'Mage' },
      active_specialization: { name: 'Fire' },
    };

    const result = buildCharacterResult(profile, null);

    expect(result.mediaUrl).toBeNull();
    expect(result.role).toBe('ranged');
    expect(result.utilities).toEqual(['lust']);
  });

  it('maps Evoker to lust only (no brez)', () => {
    const profile = {
      name: 'Scaleface',
      realm: { slug: 'area-52', name: 'Area 52' },
      character_class: { name: 'Evoker' },
      active_specialization: { name: 'Devastation' },
    };

    const result = buildCharacterResult(profile, null);

    expect(result.utilities).toEqual(['lust']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx -w packages/functions vitest run tests/lookupCharacter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement lookupCharacter**

```typescript
// packages/functions/src/lookupCharacter.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { BattleNetClient } from './battlenet';
import { getUtilitiesForClass, getRoleForSpec } from '@mythicplus/shared';
import { defineSecret } from 'firebase-functions/params';
import type { Role, Utility } from '@mythicplus/shared';

const bnetClientId = defineSecret('BNET_CLIENT_ID');
const bnetClientSecret = defineSecret('BNET_CLIENT_SECRET');

export interface CharacterResult {
  name: string;
  realm: string;
  class: string;
  role: Role;
  utilities: Utility[];
  mediaUrl: string | null;
}

// Pure logic — testable without Firebase
export function buildCharacterResult(
  profile: {
    name: string;
    realm: { slug: string; name: string };
    character_class: { name: string };
    active_specialization: { name: string };
  },
  media: { assets: Array<{ key: string; value: string }> } | null,
): CharacterResult {
  const className = profile.character_class.name;
  const specName = profile.active_specialization.name;

  const mainRawAsset = media?.assets?.find(a => a.key === 'main-raw');
  const mediaUrl = mainRawAsset?.value ?? null;

  return {
    name: profile.name,
    realm: profile.realm.name,
    class: className,
    role: getRoleForSpec(specName, className),
    utilities: getUtilitiesForClass(className),
    mediaUrl,
  };
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

export const lookupCharacter = onCall(
  { secrets: [bnetClientId, bnetClientSecret] },
  async (request) => {
    const { name, realm, region } = request.data as {
      name?: string;
      realm?: string;
      region?: string;
    };

    if (!name || !realm || !region) {
      throw new HttpsError('invalid-argument', 'name, realm, and region are required');
    }

    const db = getFirestore();
    const cacheRef = db.doc(`characters/${region}/${realm.toLowerCase()}/${name.toLowerCase()}`);

    // Check cache
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data()!;
      const cachedAt = data.cachedAt as Timestamp;
      if (cachedAt && Date.now() - cachedAt.toMillis() < CACHE_TTL_MS) {
        return data.result as CharacterResult;
      }
    }

    // Fetch from Battle.net
    const client = new BattleNetClient(bnetClientId.value(), bnetClientSecret.value());

    const profile = await client.getCharacterProfile(region, realm.toLowerCase(), name);
    if (!profile) {
      throw new HttpsError('not-found', `Character "${name}" not found on ${realm}`);
    }

    const media = await client.getCharacterMedia(region, realm.toLowerCase(), name);
    const result = buildCharacterResult(profile, media);

    // Write to cache
    await cacheRef.set({
      result,
      cachedAt: FieldValue.serverTimestamp(),
    });

    return result;
  },
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx -w packages/functions vitest run tests/lookupCharacter.test.ts`
Expected: all PASS

- [ ] **Step 5: Export from index.ts**

Add to `packages/functions/src/index.ts`:
```typescript
export { lookupCharacter } from './lookupCharacter';
```

- [ ] **Step 6: Commit**

```bash
git add packages/functions/src/lookupCharacter.ts packages/functions/tests/lookupCharacter.test.ts packages/functions/src/index.ts
git commit -m "feat(functions): add character lookup callable function with caching"
```

---

## Task 6: Frontend — Affix Bar Component

**Files:**
- Create: `activity/src/hooks/useAffixes.ts`
- Create: `activity/src/components/AffixBar.tsx`
- Modify: `activity/src/views/LobbyView.tsx`

**UI source of truth:** `Activity.pen` node `T93FW` ("Approach A — Sidebar Identity Panel") for the overall lobby layout and affix bar placement. Read the Pencil file using `batch_get` on `T93FW` for exact colors, spacing, typography, and layout structure.

- [ ] **Step 1: Create useAffixes hook (Firestore subscription)**

```typescript
// activity/src/hooks/useAffixes.ts
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/store';

export interface AffixDisplay {
  id: number;
  name: string;
  nickname: string | null;
  keystoneLevel: string;
  wowheadUrl: string;
  color: string;
}

interface AffixData {
  period: number;
  region: string;
  affixes: AffixDisplay[];
}

export function useAffixes(): AffixData | null {
  const [data, setData] = useState<AffixData | null>(null);
  const isDemoMode = useAppStore(s => s.isDemoMode);

  useEffect(() => {
    if (isDemoMode) {
      // Provide sample data in demo mode
      setData({
        period: 0,
        region: 'us',
        affixes: [
          { id: 165, name: "Lindormi's Guidance", nickname: 'training wheels', keystoneLevel: '+2–5', wowheadUrl: 'https://www.wowhead.com/affix=165/lindormis-guidance', color: '#22c55e' },
          { id: 160, name: "Xal'atath's Bargain: Devour", nickname: 'dispel', keystoneLevel: '+4–11', wowheadUrl: 'https://www.wowhead.com/affix=160/xalataths-bargain-devour', color: '#a855f7' },
          { id: 10, name: 'Fortified', nickname: null, keystoneLevel: '+7', wowheadUrl: 'https://www.wowhead.com/affix=10/fortified', color: '#ef4444' },
          { id: 147, name: "Xal'atath's Guile", nickname: 'death penalty', keystoneLevel: '+12', wowheadUrl: 'https://www.wowhead.com/affix=147/xalataths-guile', color: '#f59e0b' },
        ],
      });
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'config', 'affixes'),
      (snap) => {
        if (snap.exists()) setData(snap.data() as AffixData);
      },
      (error) => console.error('[Wheelson] Failed to load affixes:', error),
    );
    return unsub;
  }, [isDemoMode]);

  return data;
}
```

- [ ] **Step 2: Create AffixBar component**

```typescript
// activity/src/components/AffixBar.tsx
import { useAffixes } from '../hooks/useAffixes';

export function AffixBar() {
  const affixData = useAffixes();
  if (!affixData) return null;

  return (
    <div className="flex items-center justify-center gap-5 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] px-6 py-2.5">
      {/* Label */}
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-gold)] text-[11px] font-semibold tracking-wide">
          This Week's Affixes
        </span>
      </div>

      {affixData.affixes.map((affix, i) => (
        <div key={affix.id} className="flex items-center gap-5">
          {/* Separator */}
          <div className="w-px h-5 bg-[var(--border-subtle)]" />

          {/* Affix */}
          <div className="flex flex-col items-center gap-0.5">
            <a
              href={affix.wowheadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: affix.color }}
              />
              <span className="text-[var(--text-primary)] text-xs font-semibold">
                {affix.name}
              </span>
            </a>
            <div className="flex items-center gap-1">
              <span className="text-[var(--text-secondary)] text-[10px] font-mono font-medium">
                {affix.keystoneLevel}
              </span>
              {affix.nickname && (
                <span className="text-[var(--text-secondary)] text-[10px]">
                  · {affix.nickname}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Note: The exact CSS classes/variables should match the Pencil design. Adjust variable names to match the project's CSS custom properties. Check `activity/src/` for how CSS variables are defined.

- [ ] **Step 3: Add AffixBar to LobbyView**

In `activity/src/views/LobbyView.tsx`, import and add `<AffixBar />` between the lobby header and the main content area (role columns). The exact placement is between the "Players" header row and the role column grid.

```typescript
import { AffixBar } from '../components/AffixBar';

// Inside the LobbyView component, after the lobby header and before the role columns:
<AffixBar />
```

- [ ] **Step 4: Verify visually in dev mode**

Run: `cd activity && npm run dev`
Open the app in demo mode. The affix bar should render with sample data between the header and role columns.

- [ ] **Step 5: Commit**

```bash
git add activity/src/hooks/useAffixes.ts activity/src/components/AffixBar.tsx activity/src/views/LobbyView.tsx
git commit -m "feat(activity): add weekly affix bar to lobby"
```

---

## Task 7: Frontend — Raider.io Autocomplete Service

**Files:**
- Create: `activity/src/services/raiderioService.ts`
- Create: `activity/src/hooks/useCharacterSearch.ts`

- [ ] **Step 1: Create Raider.io service**

```typescript
// activity/src/services/raiderioService.ts

export interface RaiderioCharacterResult {
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  className: string;
}

export async function searchCharacters(
  query: string,
  signal?: AbortSignal,
): Promise<RaiderioCharacterResult[]> {
  const response = await fetch(
    `https://raider.io/api/search?term=${encodeURIComponent(query)}`,
    { signal },
  );

  if (!response.ok) return [];

  const data = await response.json();

  return (data.matches ?? [])
    .filter((m: { type: string }) => m.type === 'character')
    .map((m: {
      data: {
        name: string;
        class: { name: string };
        realm: { name: string; slug: string };
        region: { slug: string };
      };
    }) => ({
      name: m.data.name,
      realm: m.data.realm.name,
      realmSlug: m.data.realm.slug,
      region: m.data.region.slug,
      className: m.data.class.name,
    }));
}
```

- [ ] **Step 2: Create useCharacterSearch hook with debounce**

```typescript
// activity/src/hooks/useCharacterSearch.ts
import { useState, useEffect, useRef } from 'react';
import { searchCharacters, type RaiderioCharacterResult } from '../services/raiderioService';

export function useCharacterSearch(query: string) {
  const [results, setResults] = useState<RaiderioCharacterResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel previous request
    abortRef.current?.abort();

    if (query.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(async () => {
      try {
        const data = await searchCharacters(query, controller.signal);
        if (!controller.signal.aborted) {
          setResults(data);
          setLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return { results, loading };
}
```

- [ ] **Step 3: Verify hook works in dev mode**

Temporarily import and use the hook in a component to test that typing triggers autocomplete results from Raider.io. Remove after verifying.

- [ ] **Step 4: Commit**

```bash
git add activity/src/services/raiderioService.ts activity/src/hooks/useCharacterSearch.ts
git commit -m "feat(activity): add Raider.io character search with debounced hook"
```

---

## Task 8: Frontend — Character Lookup Cloud Function Hook

**Files:**
- Create: `activity/src/hooks/useCharacterLookup.ts`
- Modify: `activity/src/firebase.ts`

- [ ] **Step 1: Add Cloud Functions to firebase.ts**

```typescript
// Add to activity/src/firebase.ts
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const functions = getFunctions(app);

// Uncomment for local development with emulator:
// connectFunctionsEmulator(functions, 'localhost', 5001);

export { db, functions };
```

- [ ] **Step 2: Create useCharacterLookup hook**

```typescript
// activity/src/hooks/useCharacterLookup.ts
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { Role, Utility } from '@mythicplus/shared';

export interface CharacterData {
  name: string;
  realm: string;
  class: string;
  role: Role;
  utilities: Utility[];
  mediaUrl: string | null;
}

export function useCharacterLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(name: string, realm: string, region: string): Promise<CharacterData | null> {
    setLoading(true);
    setError(null);

    try {
      const fn = httpsCallable<
        { name: string; realm: string; region: string },
        CharacterData
      >(functions, 'lookupCharacter');

      const result = await fn({ name, realm, region });
      return result.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Character lookup failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { lookup, loading, error };
}
```

- [ ] **Step 3: Commit**

```bash
git add activity/src/firebase.ts activity/src/hooks/useCharacterLookup.ts
git commit -m "feat(activity): add character lookup Cloud Function hook"
```

---

## Task 9: Frontend — Wire Character Search into Identity Card

**Files:**
- Modify: `activity/src/components/PlayerModal.tsx` (or the new identity card component — check Pencil file for current component name)
- Modify: `activity/src/services/firestoreService.ts`
- Modify: `activity/src/services/types.ts`
- Modify: `activity/src/services/demoService.ts`

This task integrates Tasks 7 and 8 into the player identity UI.

**UI source of truth:** `Activity.pen` node `X6Cko` ("modal") is the identity card component. Read it via `batch_get` on `X6Cko` with `readDepth: 4` to get the exact structure — portrait header (`SabiX`), stats row (`PTglt`), name section (`RbvP9`), main spec buttons (`DzjEk`), offspec buttons (`qZKA8`), utilities (`OlYB5`), and sit-out toggle (`OPbKp`). Implementation must match this component's layout, colors, and typography.

The steps below cover the data wiring.

- [ ] **Step 1: Add linkedCharacter to SessionService interface**

In `activity/src/services/types.ts`, add to the `SessionService` interface:
```typescript
saveLinkedCharacter(playerId: string, linkedCharacter: { name: string; realm: string; region: string }): Promise<void>;
```

- [ ] **Step 2: Fix `saveRoles` to use merge and implement `saveLinkedCharacter`**

In `activity/src/services/firestoreService.ts`:

First, fix the existing `saveRoles` method to use `{ merge: true }` so it doesn't overwrite `linkedCharacter` data:
```typescript
// Change this line in saveRoles:
await setDoc(prefRef, { ... });
// To:
await setDoc(prefRef, { ... }, { merge: true });
```

Then add the new method:
```typescript
async saveLinkedCharacter(
  playerId: string,
  linkedCharacter: { name: string; realm: string; region: string },
): Promise<void> {
  const prefRef = doc(db, 'preferences', playerId);
  await setDoc(prefRef, { linkedCharacter, updatedAt: serverTimestamp() }, { merge: true });
}
```

**Important:** Both methods must use `{ merge: true }` to avoid overwriting each other's fields in the same `preferences/{playerId}` document.

- [ ] **Step 3: Add stub to demoService.ts**

```typescript
async saveLinkedCharacter(): Promise<void> {
  // no-op in demo mode
}
```

- [ ] **Step 4: Update PlayerModal / identity card with character search**

In the identity card component (currently `PlayerModal.tsx`, may be renamed per Pencil redesign):

1. Import the hooks:
```typescript
import { useCharacterSearch } from '../hooks/useCharacterSearch';
import { useCharacterLookup } from '../hooks/useCharacterLookup';
```

2. Add state for the search query and results:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const { results: searchResults, loading: searchLoading } = useCharacterSearch(searchQuery);
const { lookup, loading: lookupLoading, error: lookupError } = useCharacterLookup();
```

3. Wire the In-Game Name field's `onChange` to `setSearchQuery`

4. On selecting a search result:
```typescript
async function handleCharacterSelect(result: RaiderioCharacterResult) {
  setSearchQuery(''); // Close dropdown
  const character = await lookup(result.name, result.realmSlug, result.region);
  if (character && player?.discordId) {
    // Auto-fill role/utilities as defaults (only if not already set)
    const currentRoles = playerRolesToStringArray(player);
    if (currentRoles.length === 0) {
      // Build role string array from character data and save
      const roles = buildRolesFromCharacter(character);
      await service.saveRoles(player.discordId, player.name, roles, character.name);
    } else {
      // Just save the in-game name, don't overwrite roles
      await service.saveRoles(player.discordId, player.name, currentRoles, character.name);
    }
    // Save linked character for future sessions
    await service.saveLinkedCharacter(player.discordId, {
      name: result.name,
      realm: result.realmSlug,
      region: result.region,
    });
  }
}
```

5. Render the autocomplete dropdown below the In-Game Name field when `searchResults.length > 0`:
```typescript
{searchResults.length > 0 && (
  <div className="autocomplete-dropdown">
    {searchResults.map(r => (
      <button key={`${r.region}-${r.realmSlug}-${r.name}`} onClick={() => handleCharacterSelect(r)}>
        {r.name} - {r.realm} ({r.className})
      </button>
    ))}
  </div>
)}
```

Exact styling should match the Pencil design.

- [ ] **Step 5: Handle autosave on every field change**

Convert all role/offspec/utility toggles from batched saves to immediate saves. Each toggle calls `service.saveRoles()` directly on change instead of accumulating state and saving on "Save" click.

This is a significant refactor of the current `handleSave` pattern. The Save button is removed. Each `handleRoleToggle`, `handleOffspecToggle`, `handleUtilityToggle` calls `saveRoles` immediately.

- [ ] **Step 6: Test in dev mode**

Run: `cd activity && npm run dev`
1. Open the identity card for a player
2. Type a character name in the In-Game Name field
3. Verify autocomplete dropdown appears after 3 characters
4. Select a result → verify role/utilities auto-fill and header updates
5. Toggle a role → verify it saves immediately

- [ ] **Step 7: Commit**

```bash
git add activity/src/services/types.ts activity/src/services/firestoreService.ts activity/src/services/demoService.ts activity/src/components/PlayerModal.tsx
git commit -m "feat(activity): integrate character search and autosave into identity card"
```

---

## Task 10: Deploy & Verify

**Files:**
- No new files

- [ ] **Step 1: Set Battle.net API secrets in Firebase**

Register an application at https://develop.battle.net/ to get client ID and secret. Then:

```bash
firebase functions:secrets:set BNET_CLIENT_ID
firebase functions:secrets:set BNET_CLIENT_SECRET
```

- [ ] **Step 2: Build and deploy Cloud Functions**

```bash
cd packages/functions && npm run build
firebase deploy --only functions
```

- [ ] **Step 3: Manually trigger affix fetch**

Use the Firebase console or CLI to invoke `fetchWeeklyAffixes` manually for the first run (don't wait until Tuesday):

```bash
firebase functions:shell
> fetchWeeklyAffixes()
```

Verify the `config/affixes` document appears in Firestore with the correct affix data.

- [ ] **Step 4: Test character lookup end-to-end**

Open the activity frontend, search for a known character, verify:
- Autocomplete results appear from Raider.io
- Selecting a result calls the Cloud Function
- Character data populates the identity card
- Data persists on page reload

- [ ] **Step 5: Verify affix bar renders from live Firestore data**

Confirm the affix bar in the lobby shows the real current week's affixes from the Firestore document.

- [ ] **Step 6: Run existing tests to confirm no regressions**

```bash
./scripts/verify-ts.sh
./scripts/verify-activity.sh
```

- [ ] **Step 7: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: deployment config and final adjustments"
```
