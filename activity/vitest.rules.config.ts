import { defineConfig } from 'vitest/config';

// firestore.rules tests (activity/rules/). They need the Firestore emulator,
// so run them via ./scripts/emulator-test.sh rather than directly.
export default defineConfig({
  test: {
    include: ['rules/**/*.test.ts'],
    environment: 'node',
    // One emulator database shared by every test; clear-and-seed must not
    // interleave.
    fileParallelism: false,
  },
});
