import { test, expect } from '@playwright/test';
import { argosScreenshot } from "@argos-ci/playwright";
import { mockSession, mockPlayers } from '../src/mockData';

// Helper to encode data for URL
const encodeData = (data: any) => Buffer.from(JSON.stringify(data)).toString('base64');

test.describe('Visual Regression Tests', () => {
  // 1. Channel Picker
  test('Channel Picker View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'lobby',
      selectedChannelId: null, // Ensure picker
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#lobby')).toBeVisible();
    // Should show channel list (3 items)
    await expect(page.locator('#player-list li')).toHaveCount(mockSession.voiceChannels?.length || 0);

    // Screenshot
    await argosScreenshot(page, 'channel-picker');
  });

  // 2. Lobby with Players
  test('Lobby View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'lobby',
      selectedChannelId: 'vc-1',
      players: mockPlayers, // Inject players
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#lobby')).toBeVisible();
    // Should show player list (13 items)
    await expect(page.locator('#player-list li')).toHaveCount(mockPlayers.length);

    // Screenshot
    await argosScreenshot(page, 'lobby');
  });

  // 3. Wheel
  test('Static Wheel View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'spinning',
      staticWheel: true,
      selectedChannelId: 'vc-1',
      players: mockPlayers,
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#wheel-container')).toBeVisible();
    await expect(page.locator('#wheel-tank')).toBeVisible();

    // Screenshot
    await argosScreenshot(page, 'wheels');
  });

  // 4. Results
  test('Results View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'completed',
      selectedChannelId: 'vc-1',
      players: mockPlayers,
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('.group-card')).toHaveCount(mockSession.groups.length);

    // Screenshot
    await argosScreenshot(page, 'results');
  });
});
