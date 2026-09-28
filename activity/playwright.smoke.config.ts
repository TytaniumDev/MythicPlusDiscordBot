import { defineConfig, devices } from '@playwright/test';

// ── End-to-end smoke tests ──────────────────────────────────────────────
// The production build of the activity against the local Firebase emulators
// (Firestore with the real firestore.rules, plus Auth). There are no
// screenshots here, so unlike playwright.config.ts this runs without Docker.
//
// Run via ./scripts/smoke-test.sh, which starts the emulators and exports
// their hosts to this process.
const projectId = process.env.GCLOUD_PROJECT;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!projectId || !firestoreHost || !authHost) {
  throw new Error('Run smoke tests via ./scripts/smoke-test.sh — they need the Firebase emulators.');
}

const PORT = 4173;

export default defineConfig({
  testDir: './smoke',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  timeout: 120_000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_FIREBASE_API_KEY: 'smoke-test-api-key',
      VITE_FIREBASE_PROJECT_ID: projectId,
      VITE_FIRESTORE_EMULATOR_HOST: firestoreHost,
      VITE_FIREBASE_AUTH_EMULATOR_HOST: authHost,
    },
  },
});
