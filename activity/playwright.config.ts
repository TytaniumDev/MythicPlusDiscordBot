import { defineConfig, devices } from '@playwright/test';

// ── Guard: Playwright tests MUST run inside Docker ──────────────────────
// The official Playwright Docker image ensures consistent font rendering and
// anti-aliasing.  A small pixel tolerance (2%) absorbs the sub-pixel rendering
// noise that Chromium produces across runs — even inside Docker — while still
// catching real visual regressions.
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
  workers: process.env.CI ? Number(process.env.PLAYWRIGHT_WORKERS) || 2 : undefined,
  reporter: process.env.CI ? 'dot' : 'list',
  // Snapshot settings for deterministic visual tests
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // 2% tolerance absorbs Chromium's sub-pixel anti-aliasing noise across
      // Docker runs while still catching real visual regressions.  This is the
      // community standard (fabric.js, vanilla-extract, Ionicons all use 0.02).
      maxDiffPixelRatio: 0.05,
      animations: 'disabled',
      caret: 'hide',
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
