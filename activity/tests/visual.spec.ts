import { test, expect } from '@playwright/test';
import { mockSession, mockPlayers, mockGroups } from '../src/mockData';

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
    await expect(page.locator('#view-channels')).toBeVisible();
    // Should show channel cards (3 items)
    await expect(page.locator('.channel-card')).toHaveCount(mockSession.voiceChannels?.length || 0);

    // Screenshot
    await expect(page).toHaveScreenshot('channel-picker.png');
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
    await expect(page.locator('#view-lobby')).toBeVisible();
    // Should show player chips (13 items)
    await expect(page.locator('.player-chip')).toHaveCount(mockPlayers.length);

    // Screenshot
    await expect(page).toHaveScreenshot('lobby.png');
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
    await expect(page.locator('#view-wheels')).toBeVisible();
    await expect(page.locator('#wheel-tank')).toBeVisible();

    // Screenshot
    await expect(page).toHaveScreenshot('wheels.png');
  });

  // 4. Results
  test('Results View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'completed',
      selectedChannelId: 'vc-1',
      players: mockPlayers,
      groups: mockGroups, // Inject groups!
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#view-results')).toBeVisible();
    await expect(page.locator('.group-card')).toHaveCount(mockGroups.length);

    // Screenshot
    await expect(page).toHaveScreenshot('results.png');
  });
});
