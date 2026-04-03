import { performance } from 'node:perf_hooks';
import { PreferenceService } from '../src/core/preferenceService.js';
import { FirebaseService } from '../src/core/firebaseService.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

async function runBenchmark() {
  console.log('--- Benchmarking refreshPreference N+1 vs Batch ---');

  // Mock Firebase DB
  const mockFirebase = new FirebaseService();
  mockFirebase.db = {
    collection: (_name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          // Simulate network latency (e.g., 50ms)
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            exists: true,
            id,
            ref: {} as AnyObj,
            data: () => ({ roles: ['dps'], wowName: `Player${id}` }),
          };
        },
        set: async () => {},
        update: async () => {},
        delete: async () => {},
        onSnapshot: () => {},
      }),
      where: () => ({} as AnyObj),
      get: async () => ({ docs: [] }),
      onSnapshot: () => {},
    }),
    batch: () => ({} as AnyObj),
    getAll: async (...documentRefs: AnyObj[]) => {
      // Simulate network latency (e.g., 50ms per batch)
      await new Promise(resolve => setTimeout(resolve, 50));
      return documentRefs.map(ref => ({
        exists: true,
        id: ref.id,
        ref,
        data: () => ({ roles: ['dps'], wowName: `Player${ref.id}` }),
      }));
    },
  };

  const prefSvc = new PreferenceService(mockFirebase);

  // Generate test data
  const testIds = Array.from({ length: 20 }, (_, i) => `id_${i}`);

  console.log(`Simulating network latency of 50ms per document fetch for ${testIds.length} users.`);

  // Measure N+1
  console.log('Testing Current (N+1 Promise.all)...');
  const startNPlus1 = performance.now();
  await Promise.all(testIds.map(id => prefSvc.refreshPreference(id)));
  const endNPlus1 = performance.now();
  const timeNPlus1 = endNPlus1 - startNPlus1;
  console.log(`Current Time: ${timeNPlus1.toFixed(2)}ms`);

  // Measure Batch
  console.log('Testing Optimized (Batch db.getAll)...');
  const startBatch = performance.now();
  await prefSvc.refreshPreferences(testIds);
  const endBatch = performance.now();
  const timeBatch = endBatch - startBatch;
  console.log(`Optimized Time: ${timeBatch.toFixed(2)}ms`);

  const improvement = timeNPlus1 - timeBatch;
  const percentage = ((improvement / timeNPlus1) * 100).toFixed(2);
  console.log(`\nImprovement: ${improvement.toFixed(2)}ms (${percentage}%)`);

}

runBenchmark().catch(console.error);
