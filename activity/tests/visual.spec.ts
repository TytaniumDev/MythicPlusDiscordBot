import { test, expect } from '@playwright/test';
import { argosScreenshot } from "@argos-ci/playwright";
import { mockSession } from '../src/mockData';

// Helper to encode data for URL
const encodeData = (data: any) => Buffer.from(JSON.stringify(data)).toString('base64');

test.describe('Visual Regression Tests', () => {
  test('Lobby View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'lobby',
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#lobby')).toBeVisible();
    await expect(page.locator('#player-list li')).toHaveCount(mockSession.players.length);

    // Screenshot (Argos + Playwright native)
    await argosScreenshot(page, 'lobby');
    await expect(page).toHaveScreenshot('lobby.png');
  });

  test('Static Wheel View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'spinning',
      staticWheel: true,
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#wheel-container')).toBeVisible();
    await expect(page.locator('#wheel-tank')).toBeVisible();

    // Screenshot (Argos + Playwright native)
    await argosScreenshot(page, 'wheels');
    await expect(page).toHaveScreenshot('wheels.png');
  });

  test('Results View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'completed',
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('.group-card')).toHaveCount(mockSession.groups.length);

    // Screenshot (Argos + Playwright native)
    await argosScreenshot(page, 'results');
    await expect(page).toHaveScreenshot('results.png');
  });
});
