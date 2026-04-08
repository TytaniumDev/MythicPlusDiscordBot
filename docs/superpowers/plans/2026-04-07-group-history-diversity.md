# Group History Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the group formation algorithm track all rounds within a session night and use pair-count scoring to maximize teammate diversity.

**Architecture:** Replace the single-round `lastGroups` in-memory state with multi-round `groupHistory`. Build a pair-count matrix from all rounds and use it to score candidates in `grabNextAvailablePlayer` — lowest pair-count with existing group members wins. Firestore stores `groupHistory: { date, rounds }` on the guild doc, with a lazy daily reset via date comparison (America/Los_Angeles).

**Tech Stack:** TypeScript, Vitest, Firebase/Firestore

---

### Task 1: Update parallelGroupCreator — multi-round state and pair-count scoring

**Files:**
- Modify: `packages/shared/src/parallelGroupCreator.ts`

- [ ] **Step 1: Write the failing test for multi-round history avoidance**

In `packages/bot/tests/parallelGroupCreator.test.ts`, add this test inside the existing `describe('GroupCreator', ...)` block, after the `'avoids old teammates when possible'` test:

```ts
it('uses multi-round history to maximize diversity', () => {
  const tank = TankWarrior('Tank');
  const healer = HealerPriest('Healer');
  const dps1 = Warrior('DPS1');
  const dps2 = Warrior('DPS2');
  const dps3 = Warrior('DPS3');
  const dps4 = Warrior('DPS4');
  const dps5 = Warrior('DPS5');
  const dps6 = Warrior('DPS6');

  // Round 1: Tank played with DPS1, DPS2, DPS3
  const r1g1 = new WoWGroup();
  r1g1.tank = tank;
  r1g1.dps = [dps1, dps2, dps3];

  // Round 2: Tank played with DPS1 again (so DPS1 has count=2 with Tank)
  const r2g1 = new WoWGroup();
  r2g1.tank = tank;
  r2g1.dps = [dps1, dps4, dps5];

  setGroupHistory([
    [r1g1],
    [r2g1],
  ]);

  const allPlayers = [tank, healer, dps1, dps2, dps3, dps4, dps5, dps6];
  const groups = createMythicPlusGroups(allPlayers);

  expect(groups.length).toBeGreaterThanOrEqual(1);
  const group = groups[0];
  expect(group.tank!.equals(tank)).toBe(true);

  // DPS6 has count=0 with tank, DPS3 has count=1, DPS2 has count=1.
  // DPS1 has count=2. Algorithm should prefer DPS6 and the count=1 players.
  const dpsNames = group.dps.map((p) => p.name);
  expect(dpsNames).not.toContain('DPS1');
  expect(dpsNames).toContain('DPS6');
});
```

Also update the import at the top of the file to import `setGroupHistory` instead of `setLastGroups`:

```ts
import {
  WoWPlayer,
  WoWGroup,
  clear,
  setGroupHistory,
  createMythicPlusGroups,
} from '@mythicplus/shared';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w packages/bot run test -- --run packages/bot/tests/parallelGroupCreator.test.ts`
Expected: FAIL — `setGroupHistory` is not exported from `@mythicplus/shared`

- [ ] **Step 3: Update the module-level state and exports in parallelGroupCreator.ts**

In `packages/shared/src/parallelGroupCreator.ts`, replace the current state and exported functions:

Replace:
```ts
/** Per-guild history of last groups — avoids cross-guild contamination. */
const lastGroups = new Map<string | number | null, WoWGroup[]>();

export function clear(): void {
  lastGroups.clear();
}

export function setLastGroups(groups: WoWGroup[], guildId: string | number | null = null): void {
  lastGroups.set(guildId, groups);
}
```

With:
```ts
/** Per-guild history of all rounds tonight — avoids cross-guild contamination. */
const groupHistory = new Map<string | number | null, WoWGroup[][]>();

export function clear(): void {
  groupHistory.clear();
}

export function setGroupHistory(rounds: WoWGroup[][], guildId: string | number | null = null): void {
  groupHistory.set(guildId, rounds);
}
```

- [ ] **Step 4: Update the pair-count logic in createMythicPlusGroups**

In the same file, replace the `previousGroups` / `lastGroupsDict` block at the top of `createMythicPlusGroups`:

Replace:
```ts
  const previousGroups = lastGroups.get(guildId) ?? [];

  // Pre-compute teammate lookups for O(1) check
  const lastGroupsDict = new Map<string, Set<string>>();
  for (const group of previousGroups) {
    const members = group.players;
    for (const member of members) {
      const existing = lastGroupsDict.get(member.name);
      const teammates = existing ?? new Set<string>();
      if (!existing) lastGroupsDict.set(member.name, teammates);
      for (const m of members) {
        if (!m.equals(member)) teammates.add(m.name);
      }
    }
  }
```

With:
```ts
  const rounds = groupHistory.get(guildId) ?? [];

  // Build pair-count matrix from all rounds: how many times each pair has been grouped
  const pairCounts = new Map<string, number>();
  for (const round of rounds) {
    for (const group of round) {
      const members = group.players;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = [members[i].name, members[j].name].sort().join('|');
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }
  }
```

- [ ] **Step 5: Replace grabNextAvailablePlayer with pair-count scoring**

Replace the entire `grabNextAvailablePlayer` function:

Replace:
```ts
  function grabNextAvailablePlayer(
    availablePlayers: WoWPlayer[],
    group: WoWGroup,
    predicate?: (player: WoWPlayer) => boolean,
  ): WoWPlayer | null {
    const teammates = group.players;

    // Pre-check: Find all players that are ineligible due to previous grouping
    const ineligiblePlayers = new Set<string>();
    for (const teammate of teammates) {
      const prev = lastGroupsDict.get(teammate.name);
      if (prev) {
        for (const name of prev) ineligiblePlayers.add(name);
      }
    }

    // Try to grab a player from the available list who hasn't played with this group before
    for (const player of availablePlayers) {
      if (ineligiblePlayers.has(player.name)) continue;
      if (!usedPlayers.has(player.name)) {
        if (predicate && !predicate(player)) continue;
        removePlayer(player);
        return player;
      }
    }

    // Fallback if we can't find a player who hasn't played with this group before
    for (const player of availablePlayers) {
      if (!usedPlayers.has(player.name)) {
        if (predicate && !predicate(player)) continue;
        removePlayer(player);
        return player;
      }
    }

    return null;
  }
```

With:
```ts
  function grabNextAvailablePlayer(
    availablePlayers: WoWPlayer[],
    group: WoWGroup,
    predicate?: (player: WoWPlayer) => boolean,
  ): WoWPlayer | null {
    const teammates = group.players;

    let bestPlayer: WoWPlayer | null = null;
    let bestScore = Infinity;

    for (const player of availablePlayers) {
      if (usedPlayers.has(player.name)) continue;
      if (predicate && !predicate(player)) continue;

      // Score = total times this player has been grouped with current teammates
      let score = 0;
      for (const teammate of teammates) {
        const key = [player.name, teammate.name].sort().join('|');
        score += pairCounts.get(key) ?? 0;
      }

      if (score < bestScore) {
        bestScore = score;
        bestPlayer = player;
      }
    }

    if (bestPlayer) {
      removePlayer(bestPlayer);
    }

    return bestPlayer;
  }
```

- [ ] **Step 6: Update history append at end of createMythicPlusGroups**

Replace the last line before `return groups;`:

Replace:
```ts
  lastGroups.set(guildId, groups);
  return groups;
```

With:
```ts
  groupHistory.set(guildId, [...rounds, groups]);
  return groups;
```

- [ ] **Step 7: Update shared package exports**

In `packages/shared/src/index.ts`, replace:
```ts
export {
  clear,
  setLastGroups,
  createMythicPlusGroups,
} from './parallelGroupCreator.js';
```

With:
```ts
export {
  clear,
  setGroupHistory,
  createMythicPlusGroups,
} from './parallelGroupCreator.js';
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm -w packages/bot run test -- --run packages/bot/tests/parallelGroupCreator.test.ts`
Expected: PASS for the new test. Some existing tests may need updating — see next steps.

- [ ] **Step 9: Update the existing `'avoids old teammates when possible'` test**

This test uses `setLastGroups` which no longer exists. Update it to use `setGroupHistory`:

Replace:
```ts
  it('avoids old teammates when possible', () => {
    const tank = TankWarrior('Tank');
    const healer = HealerPriest('Healer');
    const dps1 = Warrior('DPS1');
    const dps2 = Warrior('DPS2');
    const dps3 = Warrior('DPS3');
    const dps4 = Warrior('DPS4');
    const dps5 = Warrior('DPS5');
    const dps6 = Warrior('DPS6');

    // Setup history: Tank played with DPS1, DPS2, DPS3
    const g1 = new WoWGroup();
    g1.tank = tank;
    g1.dps = [dps1, dps2, dps3];
    setLastGroups([g1]);

    const allPlayers = [tank, healer, dps1, dps2, dps3, dps4, dps5, dps6];
    const groups = createMythicPlusGroups(allPlayers);

    expect(groups.length).toBeGreaterThanOrEqual(1);
    const group = groups[0];

    expect(group.tank!.equals(tank)).toBe(true);
    expect(group.healer!.equals(healer)).toBe(true);

    const dpsNames = new Set(group.dps.map((p) => p.name));
    const expectedFreshDps = new Set(['DPS4', 'DPS5', 'DPS6']);
    const intersection = new Set([...dpsNames].filter((n) => expectedFreshDps.has(n)));
    expect(intersection.size).toBe(3);
  });
```

With:
```ts
  it('avoids old teammates when possible', () => {
    const tank = TankWarrior('Tank');
    const healer = HealerPriest('Healer');
    const dps1 = Warrior('DPS1');
    const dps2 = Warrior('DPS2');
    const dps3 = Warrior('DPS3');
    const dps4 = Warrior('DPS4');
    const dps5 = Warrior('DPS5');
    const dps6 = Warrior('DPS6');

    // Setup history: Tank played with DPS1, DPS2, DPS3
    const g1 = new WoWGroup();
    g1.tank = tank;
    g1.dps = [dps1, dps2, dps3];
    setGroupHistory([[g1]]);

    const allPlayers = [tank, healer, dps1, dps2, dps3, dps4, dps5, dps6];
    const groups = createMythicPlusGroups(allPlayers);

    expect(groups.length).toBeGreaterThanOrEqual(1);
    const group = groups[0];

    expect(group.tank!.equals(tank)).toBe(true);
    expect(group.healer!.equals(healer)).toBe(true);

    const dpsNames = new Set(group.dps.map((p) => p.name));
    const expectedFreshDps = new Set(['DPS4', 'DPS5', 'DPS6']);
    const intersection = new Set([...dpsNames].filter((n) => expectedFreshDps.has(n)));
    expect(intersection.size).toBe(3);
  });
```

- [ ] **Step 10: Run all parallelGroupCreator tests**

Run: `npm -w packages/bot run test -- --run packages/bot/tests/parallelGroupCreator.test.ts`
Expected: All PASS

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/parallelGroupCreator.ts packages/shared/src/index.ts packages/bot/tests/parallelGroupCreator.test.ts
git commit -m "feat: use multi-round pair-count scoring for group diversity"
```

---

### Task 2: Update Firebase interface and implementation

**Files:**
- Modify: `packages/bot/src/core/firebaseService.ts:60-66` (interface)
- Modify: `packages/bot/src/core/firebaseService.ts:372-385` (implementation)

- [ ] **Step 1: Write failing tests for the new Firebase methods**

In `packages/bot/tests/firebaseService.test.ts`, replace the `getPreviousGroups` and `savePreviousGroups` test blocks (lines 201-327) with tests for the new methods.

First, add the import for `WoWGroupDict` at the top of the file alongside the existing `WoWPlayer`, `WoWGroup` imports:

```ts
import { WoWPlayer, WoWGroup, type WoWGroupDict } from '@mythicplus/shared';
```

Then replace both describe blocks (`FirebaseService.getPreviousGroups` and `FirebaseService.savePreviousGroups`) with:

```ts
describe('FirebaseService.getGroupHistory', () => {
  let service: FirebaseService;

  function createMockDbWithDocRef() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
      where: vi.fn(),
      get: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn(),
    };
    return { db, mockCollection, mockDocRef };
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
  });

  it('returns null when db is null', async () => {
    service.db = null;
    const result = await service.getGroupHistory('123');
    expect(result).toBeNull();
  });

  it('returns null when guild doc does not exist', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => null });

    const result = await service.getGroupHistory('123');
    expect(result).toBeNull();
  });

  it('returns null when guild doc has no groupHistory field', async () => {
    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ guildId: '123' }),
    });

    const result = await service.getGroupHistory('123');
    expect(result).toBeNull();
  });

  it('returns groupHistory from guild doc', async () => {
    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const group = new WoWGroup(tank, null, []);
    const rounds: WoWGroupDict[][] = [[group.toDict()]];

    const { db, mockDocRef } = createMockDbWithDocRef();
    service.db = db as unknown as FirebaseService['db'];
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ guildId: '123', groupHistory: { date: '2026-04-07', rounds } }),
    });

    const result = await service.getGroupHistory('123');
    expect(result).toEqual({ date: '2026-04-07', rounds });
  });
});

describe('FirebaseService.saveGroupHistory', () => {
  let service: FirebaseService;

  function createMockDbWithDocRef() {
    const mockDocRef = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const mockCollection = {
      doc: vi.fn().mockReturnValue(mockDocRef),
      where: vi.fn(),
      get: vi.fn(),
      onSnapshot: vi.fn(),
    };
    const db = {
      collection: vi.fn().mockReturnValue(mockCollection),
      batch: vi.fn(),
    };
    return { db, mockCollection, mockDocRef };
  }

  beforeEach(() => {
    service = Object.create(FirebaseService.prototype);
  });

  it('does nothing when db is null', async () => {
    service.db = null;
    await service.saveGroupHistory('123', { date: '2026-04-07', rounds: [] });
  });

  it('upserts guild doc with groupHistory using set with merge', async () => {
    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const group = new WoWGroup(tank, null, []);
    const rounds: WoWGroupDict[][] = [[group.toDict()]];
    const history = { date: '2026-04-07', rounds };

    const { db, mockDocRef } = createMockDbWithDocRef();
    mockDocRef.set.mockResolvedValue(undefined);
    service.db = db as unknown as FirebaseService['db'];

    await service.saveGroupHistory('456', history);

    expect(db.collection).toHaveBeenCalledWith('guilds');
    expect(mockDocRef.set).toHaveBeenCalledWith(
      { groupHistory: history },
      { merge: true },
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm -w packages/bot run test -- --run packages/bot/tests/firebaseService.test.ts`
Expected: FAIL — `getGroupHistory` / `saveGroupHistory` don't exist

- [ ] **Step 3: Update the Firebase interface**

In `packages/bot/src/core/firebaseService.ts`, replace the interface methods (around lines 65-66):

Replace:
```ts
  getPreviousGroups(guildId: string): Promise<Record<string, unknown>[]>;
  savePreviousGroups(guildId: string, groups: Record<string, unknown>[]): Promise<void>;
```

With:
```ts
  getGroupHistory(guildId: string): Promise<{ date: string; rounds: Record<string, unknown>[][] } | null>;
  saveGroupHistory(guildId: string, history: { date: string; rounds: Record<string, unknown>[][] }): Promise<void>;
```

- [ ] **Step 4: Update the Firebase implementation**

In the same file, replace the method implementations (around lines 372-385):

Replace:
```ts
  async getPreviousGroups(guildId: string): Promise<Record<string, unknown>[]> {
    if (!this.db) return [];
    const docRef = this.db.collection('guilds').doc(guildId);
    const doc = await docRef.get();
    if (!doc.exists) return [];
    const data = doc.data();
    return (data?.previousGroups as Record<string, unknown>[] | undefined) ?? [];
  }

  async savePreviousGroups(guildId: string, groups: Record<string, unknown>[]): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('guilds').doc(guildId);
    await docRef.set({ previousGroups: groups }, { merge: true });
  }
```

With:
```ts
  async getGroupHistory(guildId: string): Promise<{ date: string; rounds: Record<string, unknown>[][] } | null> {
    if (!this.db) return null;
    const docRef = this.db.collection('guilds').doc(guildId);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const data = doc.data();
    const history = data?.groupHistory as { date: string; rounds: Record<string, unknown>[][] } | undefined;
    return history ?? null;
  }

  async saveGroupHistory(guildId: string, history: { date: string; rounds: Record<string, unknown>[][] }): Promise<void> {
    if (!this.db) return;
    const docRef = this.db.collection('guilds').doc(guildId);
    await docRef.set({ groupHistory: history }, { merge: true });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm -w packages/bot run test -- --run packages/bot/tests/firebaseService.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add packages/bot/src/core/firebaseService.ts packages/bot/tests/firebaseService.test.ts
git commit -m "feat: replace previousGroups with groupHistory in Firebase"
```

---

### Task 3: Update GroupService to use multi-round history with daily reset

**Files:**
- Modify: `packages/bot/src/services/groupService.ts`
- Modify: `packages/bot/tests/groupService.test.ts`

- [ ] **Step 1: Write failing tests for the updated GroupService**

In `packages/bot/tests/groupService.test.ts`, make these changes:

First, update the mock setup at the top. Replace:
```ts
const { mockFirebaseInstance } = vi.hoisted(() => {
  const mockFirebaseInstance = {
    isAvailable: vi.fn().mockReturnValue(false),
    getPreviousGroups: vi.fn().mockResolvedValue([]),
    savePreviousGroups: vi.fn().mockResolvedValue(undefined),
  };
  return { mockFirebaseInstance };
});
```

With:
```ts
const { mockFirebaseInstance } = vi.hoisted(() => {
  const mockFirebaseInstance = {
    isAvailable: vi.fn().mockReturnValue(false),
    getGroupHistory: vi.fn().mockResolvedValue(null),
    saveGroupHistory: vi.fn().mockResolvedValue(undefined),
  };
  return { mockFirebaseInstance };
});
```

Update the shared mock to use `setGroupHistory`:
```ts
vi.mock('@mythicplus/shared', async () => {
  const actual = await vi.importActual('@mythicplus/shared');
  return {
    ...(actual as Record<string, unknown>),
    createMythicPlusGroups: vi.fn(),
    setGroupHistory: vi.fn(),
  };
});
```

Update the import line:
```ts
import { createMythicPlusGroups, setGroupHistory } from '@mythicplus/shared';
```

Then replace the entire `describe('GroupService Firebase previousGroups integration', ...)` block with:

```ts
describe('GroupService Firebase groupHistory integration', () => {
  beforeEach(() => {
    mockFirebaseInstance.isAvailable.mockReturnValue(true);
    mockFirebaseInstance.getGroupHistory.mockResolvedValue(null);
    mockFirebaseInstance.saveGroupHistory.mockResolvedValue(undefined);
  });

  it('loads group history from Firebase and calls setGroupHistory for today', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const round = [new WoWGroup(tank, null, []).toDict()];
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    mockFirebaseInstance.getGroupHistory.mockResolvedValue({ date: today, rounds: [round] });

    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.getGroupHistory).toHaveBeenCalledWith('42');
    expect(setGroupHistory).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(Array)]),
      '42',
    );
  });

  it('discards stale history from a previous day', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    mockFirebaseInstance.getGroupHistory.mockResolvedValue({
      date: '2020-01-01',
      rounds: [[ new WoWGroup(tank, null, []).toDict() ]],
    });

    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    await service.getGroupsData(ctx, true);

    expect(setGroupHistory).not.toHaveBeenCalled();
  });

  it('saves group history with today date and appended round', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const group = new WoWGroup(tank, null, []);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

    // No existing history
    mockFirebaseInstance.getGroupHistory.mockResolvedValue(null);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([group]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.saveGroupHistory).toHaveBeenCalledWith(
      '42',
      {
        date: today,
        rounds: expect.arrayContaining([
          expect.arrayContaining([expect.objectContaining({ tank: expect.objectContaining({ name: 'Tank1' }) })]),
        ]),
      },
    );
  });

  it('appends to existing rounds when history is from today', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    const group = new WoWGroup(tank, null, []);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

    const existingRound = [new WoWGroup(tank, null, []).toDict()];
    mockFirebaseInstance.getGroupHistory.mockResolvedValue({ date: today, rounds: [existingRound] });
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([group]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.saveGroupHistory).toHaveBeenCalledWith(
      '42',
      {
        date: today,
        rounds: expect.any(Array),
      },
    );
    // Should have 2 rounds: the existing one + the new one
    const savedHistory = vi.mocked(mockFirebaseInstance.saveGroupHistory).mock.calls[0][1];
    expect(savedHistory.rounds).toHaveLength(2);
  });

  it('skips Firebase when guild is null', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: null });

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.getGroupHistory).not.toHaveBeenCalled();
    expect(mockFirebaseInstance.saveGroupHistory).not.toHaveBeenCalled();
  });

  it('skips Firebase when not available', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });
    mockFirebaseInstance.isAvailable.mockReturnValue(false);

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.getGroupHistory).not.toHaveBeenCalled();
    expect(mockFirebaseInstance.saveGroupHistory).not.toHaveBeenCalled();
  });

  it('does not call setGroupHistory when no history exists', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });
    mockFirebaseInstance.getGroupHistory.mockResolvedValue(null);

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    await service.getGroupsData(ctx, true);

    expect(mockFirebaseInstance.getGroupHistory).toHaveBeenCalled();
    expect(setGroupHistory).not.toHaveBeenCalled();
  });

  it('gracefully handles Firebase load errors', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });
    mockFirebaseInstance.getGroupHistory.mockRejectedValue(new Error('network error'));

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    const result = await service.getGroupsData(ctx, true);
    expect(result).not.toBeNull();
    expect(createMythicPlusGroups).toHaveBeenCalled();
  });

  it('gracefully handles Firebase save errors', async () => {
    const service = new GroupService();
    const ctx = makeCtx({ guild: { id: '42' } });
    mockFirebaseInstance.saveGroupHistory.mockRejectedValue(new Error('write error'));

    const tank = WoWPlayer.create('Tank1', ['Tank']);
    vi.mocked(getDebugPlayers).mockReturnValue([tank]);
    vi.mocked(createMythicPlusGroups).mockReturnValue([new WoWGroup(tank, null, [])]);

    const result = await service.getGroupsData(ctx, true);
    expect(result).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm -w packages/bot run test -- --run packages/bot/tests/groupService.test.ts`
Expected: FAIL — GroupService still references old methods

- [ ] **Step 3: Update GroupService implementation**

In `packages/bot/src/services/groupService.ts`, replace the import:

Replace:
```ts
import { WoWGroup, WoWPlayer, createMythicPlusGroups, setLastGroups } from '@mythicplus/shared';
```

With:
```ts
import { WoWGroup, WoWPlayer, createMythicPlusGroups, setGroupHistory } from '@mythicplus/shared';
```

Replace `_loadPreviousGroups`:
```ts
  private async _loadPreviousGroups(
    firebase: FirebaseService,
    guildId: string,
  ): Promise<void> {
    if (!firebase.isAvailable()) return;

    try {
      const prevGroupDicts = await firebase.getPreviousGroups(guildId);
      if (prevGroupDicts.length > 0) {
        const previousGroups = prevGroupDicts.map((g) => WoWGroup.fromDict(g));
        setLastGroups(previousGroups, guildId);
      }
    } catch (err) {
      logger.warn(`Failed to load previous groups for guild ${guildId}: ${err}`);
    }
  }
```

With:
```ts
  /** Loaded history rounds for use in _saveGroupHistory. */
  private loadedRounds: Map<string, Record<string, unknown>[][]> = new Map();

  private async _loadGroupHistory(
    firebase: FirebaseService,
    guildId: string,
  ): Promise<void> {
    if (!firebase.isAvailable()) return;

    try {
      const history = await firebase.getGroupHistory(guildId);
      if (!history) {
        this.loadedRounds.set(guildId, []);
        return;
      }

      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      if (history.date !== today) {
        this.loadedRounds.set(guildId, []);
        return;
      }

      this.loadedRounds.set(guildId, history.rounds);
      const rounds = history.rounds.map((round) =>
        round.map((g) => WoWGroup.fromDict(g)),
      );
      setGroupHistory(rounds, guildId);
    } catch (err) {
      logger.warn(`Failed to load group history for guild ${guildId}: ${err}`);
    }
  }
```

Replace `_savePreviousGroups`:
```ts
  private async _savePreviousGroups(
    firebase: FirebaseService,
    guildId: string,
    groups: WoWGroup[],
  ): Promise<void> {
    if (!firebase.isAvailable()) return;

    try {
      await firebase.savePreviousGroups(
        guildId,
        groups.map((g) => g.toDict() as Record<string, unknown>),
      );
    } catch (err) {
      logger.warn(`Failed to save previous groups for guild ${guildId}: ${err}`);
    }
  }
```

With:
```ts
  private async _saveGroupHistory(
    firebase: FirebaseService,
    guildId: string,
    groups: WoWGroup[],
  ): Promise<void> {
    if (!firebase.isAvailable()) return;

    try {
      const existingRounds = this.loadedRounds.get(guildId) ?? [];
      const newRound = groups.map((g) => g.toDict() as Record<string, unknown>);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      await firebase.saveGroupHistory(guildId, {
        date: today,
        rounds: [...existingRounds, newRound],
      });
    } catch (err) {
      logger.warn(`Failed to save group history for guild ${guildId}: ${err}`);
    }
  }
```

Update `getGroupsData` to call the new methods. Replace:
```ts
    if (guildId && firebase) {
      await this._loadPreviousGroups(firebase, guildId);
    }

    const groups = createMythicPlusGroups(players, debug, guildId);

    if (guildId && firebase) {
      await this._savePreviousGroups(firebase, guildId, groups);
    }
```

With:
```ts
    if (guildId && firebase) {
      await this._loadGroupHistory(firebase, guildId);
    }

    const groups = createMythicPlusGroups(players, debug, guildId);

    if (guildId && firebase) {
      await this._saveGroupHistory(firebase, guildId, groups);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm -w packages/bot run test -- --run packages/bot/tests/groupService.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/bot/src/services/groupService.ts packages/bot/tests/groupService.test.ts
git commit -m "feat: update GroupService to use multi-round group history with daily reset"
```

---

### Task 4: Update frontend firestoreService

**Files:**
- Modify: `activity/src/services/firestoreService.ts`
- Modify: `activity/src/types.ts`

- [ ] **Step 1: Update GuildData type**

In `activity/src/types.ts`, replace:
```ts
  previousGroups?: Record<string, unknown>[];
```

With:
```ts
  groupHistory?: {
    date: string;
    rounds: Record<string, unknown>[][];
  };
```

- [ ] **Step 2: Update firestoreService.ts imports**

In `activity/src/services/firestoreService.ts`, replace:
```ts
import { WoWPlayer, WoWGroup, createMythicPlusGroups, setLastGroups } from '@mythicplus/shared';
```

With:
```ts
import { WoWPlayer, WoWGroup, createMythicPlusGroups, setGroupHistory } from '@mythicplus/shared';
```

- [ ] **Step 3: Update requestSpin to use groupHistory**

In `activity/src/services/firestoreService.ts`, replace the history loading and saving in `requestSpin()`:

Replace:
```ts
    // Restore previous groups from Firestore so the algorithm avoids repeat groupings
    if (guildData?.previousGroups?.length) {
      const previousGroups = guildData.previousGroups.map(
        g => WoWGroup.fromDict(g),
      );
      setLastGroups(previousGroups, guildId);
    }
```

With:
```ts
    // Restore group history from Firestore so the algorithm avoids repeat groupings
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    let existingRounds: Record<string, unknown>[][] = [];
    if (guildData?.groupHistory && guildData.groupHistory.date === today) {
      existingRounds = guildData.groupHistory.rounds;
      const rounds = existingRounds.map(round =>
        round.map(g => WoWGroup.fromDict(g)),
      );
      setGroupHistory(rounds, guildId);
    }
```

Replace the history save block:
```ts
    // Persist computed groups to guild doc for cross-session history.
    // Intentionally not awaited — history save should not block the spin.
    if (guildId) {
      const guildDocRef = doc(db, 'guilds', guildId);
      setDoc(guildDocRef, {
        previousGroups: groups.map(g => g.toDict()),
      }, { merge: true }).catch(err => console.error('[Wheelson] Failed to save previousGroups:', err));
    }
```

With:
```ts
    // Persist group history to guild doc for cross-session diversity.
    // Intentionally not awaited — history save should not block the spin.
    if (guildId) {
      const guildDocRef = doc(db, 'guilds', guildId);
      const newRound = groups.map(g => g.toDict());
      setDoc(guildDocRef, {
        groupHistory: { date: today, rounds: [...existingRounds, newRound] },
      }, { merge: true }).catch(err => console.error('[Wheelson] Failed to save groupHistory:', err));
    }
```

- [ ] **Step 4: Run typecheck to verify no errors**

Run: `npm -w packages/shared run typecheck && npm -w packages/bot run typecheck && cd activity && npm run typecheck`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add activity/src/types.ts activity/src/services/firestoreService.ts
git commit -m "feat: update frontend to use multi-round group history"
```

---

### Task 5: Run full verification

**Files:** None (verification only)

- [ ] **Step 1: Run the backend verification script**

Run: `./scripts/verify-ts.sh`
Expected: lint + typecheck + all tests pass

- [ ] **Step 2: Run the frontend verification script**

Run: `./scripts/verify-activity.sh`
Expected: typecheck + build pass

- [ ] **Step 3: Commit any remaining fixes if needed**

If any lint/type issues were found, fix and commit.
