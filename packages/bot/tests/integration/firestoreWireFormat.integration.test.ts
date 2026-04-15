/**
 * Integration test: exercises the real Firestore write path against the
 * Firestore emulator. Unit tests mock the SDK and will accept any data
 * shape — real Firestore rejects nested arrays and other data-model
 * violations. The Apr 2026 Wheelson outage (nested-arrays in groupHistory)
 * would have failed this test at PR time.
 *
 * Run via: ./scripts/emulator-test.sh (from repo root)
 * which wraps: firebase emulators:exec --only firestore 'vitest run integration'
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import admin from 'firebase-admin';
import { WoWPlayer, WoWGroup } from '@mythicplus/shared';
import { FirebaseService } from '../../src/core/firebaseService.js';

// Skip whole file if not running under the emulator — keeps `vitest run` fast
// for developers who haven't started the emulator.
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const shouldRun = Boolean(EMULATOR_HOST);

describe.skipIf(!shouldRun)('FirebaseService against real Firestore emulator', () => {
  let service: FirebaseService;
  let db: admin.firestore.Firestore;

  beforeAll(() => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: 'demo-wheelson-emulator' });
    }
    db = admin.firestore();
    service = Object.create(FirebaseService.prototype);
    (service as unknown as { db: admin.firestore.Firestore }).db = db;
  });

  beforeEach(async () => {
    // Clear state between tests so assertions are deterministic.
    const guilds = await db.collection('guilds').get();
    await Promise.all(guilds.docs.map((d) => d.ref.delete()));
  });

  describe('saveGroupHistory', () => {
    it('rejects nested arrays — regression test for the Apr 2026 Wheelson outage', async () => {
      // This is the exact shape PR #383 attempted to write. It worked in
      // unit tests (mocked setDoc accepted anything) but failed in prod
      // because Firestore rejects arrays-of-arrays server-side.
      const docRef = db.collection('_regression_test').doc('nested-array-write');
      // Emulator surfaces the failure as "Cannot convert an array value in an
      // array value"; prod surfaces it as "invalid nested entity". Match both
      // phrasings rather than pinning to one string that might shift.
      await expect(
        docRef.set({
          groupHistory: { date: '2026-04-14', rounds: [[{ tank: null, healer: null, dps: [] }]] },
        }),
      ).rejects.toThrow(/nested entity|nested array|array value in an array/i);
    });

    it('persists round-trip through the wire format wrapper', async () => {
      const tank = WoWPlayer.create('Tank1', ['Tank']);
      const healer = WoWPlayer.create('Heal1', ['Healer']);
      const round1 = [new WoWGroup(tank, healer, []).toDict()];

      await service.saveGroupHistory('guild-alpha', {
        date: '2026-04-14',
        rounds: [round1],
      });

      const loaded = await service.getGroupHistory('guild-alpha');
      expect(loaded).not.toBeNull();
      expect(loaded?.date).toBe('2026-04-14');
      expect(loaded?.rounds).toHaveLength(1);
      expect(loaded?.rounds[0]).toHaveLength(1);
    });

    it('accumulates multiple rounds for the same guild', async () => {
      const p = WoWPlayer.create('Tank1', ['Tank']);
      const round = (name: string) => [new WoWGroup(WoWPlayer.create(name, ['Tank']), null, []).toDict()];

      await service.saveGroupHistory('guild-beta', { date: '2026-04-14', rounds: [round('A')] });
      const r1 = await service.getGroupHistory('guild-beta');
      await service.saveGroupHistory('guild-beta', {
        date: '2026-04-14',
        rounds: [...(r1?.rounds ?? []), round('B')],
      });

      const final = await service.getGroupHistory('guild-beta');
      expect(final?.rounds).toHaveLength(2);
      expect(p).toBeTruthy();
    });

    it('stores rounds in the wire format on disk (arrays wrapped as { groups: [...] })', async () => {
      // Asserts the on-disk shape directly — this is what prevents the
      // nested-array regression from silently sneaking back in.
      const tank = WoWPlayer.create('Tank1', ['Tank']);
      const round = [new WoWGroup(tank, null, []).toDict()];

      await service.saveGroupHistory('guild-gamma', { date: '2026-04-14', rounds: [round] });

      const raw = await db.collection('guilds').doc('guild-gamma').get();
      const stored = raw.data()?.groupHistory as { rounds: unknown[] };
      expect(stored.rounds).toHaveLength(1);
      expect(stored.rounds[0]).toMatchObject({ groups: expect.any(Array) });
      expect(Array.isArray(stored.rounds[0])).toBe(false);
    });

    it('tolerates legacy flat shape on read for forward-compatibility', async () => {
      // If any pre-wrap data ever lands in the doc, getGroupHistory should
      // still surface it rather than crashing the spin.
      const tank = WoWPlayer.create('Tank1', ['Tank']);
      const groupDict = new WoWGroup(tank, null, []).toDict();

      await db.collection('guilds').doc('guild-legacy').set({
        // Note: written as OBJECTS, not nested arrays, since nested arrays
        // would be rejected. But the inner structure simulates the legacy
        // "rounds contained groups directly" assumption.
        groupHistory: { date: '2026-04-14', rounds: [{ legacyField: 'x', groups: [groupDict] }] },
      });

      const loaded = await service.getGroupHistory('guild-legacy');
      expect(loaded?.rounds).toHaveLength(1);
    });
  });
});
