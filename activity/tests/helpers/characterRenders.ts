import type { Page } from '@playwright/test';

// 1×1 grey PNG. Every Blizzard character render in the tests resolves to this
// image, so portrait snapshots don't depend on render.worldofwarcraft.com being
// reachable, how far a large main-raw.png has loaded when the screenshot is
// taken, or what gear the fixture characters currently wear.
const PLACEHOLDER_RENDER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkqAcAAIUAgUW0RjgAAAAASUVORK5CYII=',
  'base64',
);

/**
 * Intercept Blizzard character render requests and return a fixed placeholder
 * so visual snapshots stay deterministic. Requires `serviceWorkers: 'block'`
 * (set in playwright.config.ts): the app's render-caching service worker would
 * otherwise fetch these itself, bypassing page.route.
 */
export async function mockCharacterRenders(page: Page) {
  await page.route('https://render.worldofwarcraft.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: PLACEHOLDER_RENDER,
    });
  });
}
