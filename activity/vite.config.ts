/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const commitHash = process.env.PLAYWRIGHT_TEST ? 'abc1234' : execSync('git rev-parse --short HEAD').toString().trim();
export default defineConfig({
  root: 'src',
  base: './',
  // Important for GitHub Pages relative paths
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Ship source maps so Sentry can symbolicate minified stack traces.
    // GitHub Pages serves the .map files alongside assets and Sentry fetches
    // them on demand — no upload step required.
    sourcemap: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    // Upload source maps to Sentry at build time and then strip them from the
    // deployed bundle — Sentry keeps a private copy for stack-trace
    // symbolication. No-ops when SENTRY_AUTH_TOKEN is absent (local dev,
    // Storybook, CI without the secret), so builds still work without it.
    sentryVitePlugin({
      org: 'tytaniumdev',
      project: 'mythic-plus-discord-bot',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      release: { name: commitHash },
      sourcemaps: {
        // Path is relative to Vite's `root` ('src'), which resolves outside
        // the root to the actual emitted `activity/dist` dir.
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
    }),
  ],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash)
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['**/*.test.ts', '**/*.test.tsx'],
          environment: 'jsdom',
        },
      },
      {
        extends: true,
        plugins: [
        // The plugin will run tests for the stories defined in your Storybook config
        // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
        storybookTest({
          configDir: path.join(dirname, '.storybook')
        })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{
              browser: 'chromium'
            }]
          }
        }
      },
    ]
  }
});