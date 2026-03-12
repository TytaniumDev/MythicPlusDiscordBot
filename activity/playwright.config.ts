import { defineConfig, devices } from '@playwright/test';

// ── Guard: Playwright tests MUST run inside Docker ──────────────────────
// Screenshots are pixel-compared with zero tolerance, so rendering must be
// identical between local runs and CI.  The official Playwright Docker image
// guarantees deterministic font rendering and anti-aliasing.
//
// Use:  ./scripts/playwright-docker.sh            (run tests)
//       ./scripts/playwright-docker.sh --update-snapshots   (regenerate)
//       ./scripts/verify-activity.sh              (full frontend verification)
//
// NEVER run `npx playwright test` directly on the host.
if (!process.env.PLAYWRIGHT_TEST) {
  const RED = '\x1b[31m';
  const BOLD = '\x1b[1m';
  const RESET = '\x1b[0m';
  console.error(`
${RED}${BOLD}ERROR: Playwright tests must run inside Docker for deterministic screenshots.${RESET}

  Run one of:
    ${BOLD}./scripts/playwright-docker.sh${RESET}                    # run tests
    ${BOLD}./scripts/playwright-docker.sh --update-snapshots${RESET} # regenerate screenshots
    ${BOLD}./scripts/verify-activity.sh${RESET}                      # full frontend verification

  Do NOT run \`npx playwright test\` directly.
`);
  process.exit(1);
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'dot' : 'list',
  // Snapshot settings for deterministic visual tests
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // Docker container (scripts/playwright-docker.sh) ensures identical rendering
      // across local and CI environments — no tolerance needed.
      maxDiffPixelRatio: 0,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Consistent viewport for reproducible screenshots
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: { PLAYWRIGHT_TEST: '1' },
  },
});
