import { test, expect } from '@playwright/test';
import { argosScreenshot } from "@argos-ci/playwright";

// Helper to encode data for URL
const encodeData = (data: any) => Buffer.from(JSON.stringify(data)).toString('base64');

// Mock Data
const mockPlayers = [
  { name: 'TankPlayer', roles: { tankMain: true, healerMain: false, dpsMain: false, offtank: false, offhealer: false, offdps: true, ranged: false, melee: true, hasBrez: false, hasLust: false } },
  { name: 'HealerPlayer', roles: { tankMain: false, healerMain: true, dpsMain: false, offtank: false, offhealer: false, offdps: false, ranged: true, melee: false, hasBrez: true, hasLust: false } },
  { name: 'DpsPlayer1', roles: { tankMain: false, healerMain: false, dpsMain: true, offtank: false, offhealer: false, offdps: false, ranged: true, melee: false, hasBrez: false, hasLust: true } },
  { name: 'DpsPlayer2', roles: { tankMain: false, healerMain: false, dpsMain: true, offtank: false, offhealer: false, offdps: false, ranged: false, melee: true, hasBrez: false, hasLust: false } },
  { name: 'DpsPlayer3', roles: { tankMain: false, healerMain: false, dpsMain: true, offtank: false, offhealer: false, offdps: false, ranged: true, melee: false, hasBrez: true, hasLust: false } },
  { name: 'FlexPlayer', roles: { tankMain: false, healerMain: false, dpsMain: true, offtank: true, offhealer: true, offdps: false, ranged: false, melee: true, hasBrez: false, hasLust: false } },
];

const mockGroup = {
  tank: mockPlayers[0],
  healer: mockPlayers[1],
  dps: [mockPlayers[2], mockPlayers[3], mockPlayers[4]],
};

test.describe('Visual Regression Tests', () => {
  test('Lobby View', async ({ page }) => {
    const data = {
      status: 'lobby',
      players: mockPlayers,
      groups: [],
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#lobby')).toBeVisible();
    await expect(page.locator('#player-list li')).toHaveCount(6);

    // Screenshot
    await argosScreenshot(page, 'lobby');
  });

  test('Static Wheel View', async ({ page }) => {
    const data = {
      status: 'spinning',
      staticWheel: true,
      players: mockPlayers,
      groups: [],
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#wheel-container')).toBeVisible();
    await expect(page.locator('#wheel-tank')).toBeVisible();

    // Screenshot
    await argosScreenshot(page, 'wheels');
  });

  test('Results View', async ({ page }) => {
    const data = {
      status: 'completed',
      players: mockPlayers,
      groups: [mockGroup],
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('.group-card')).toHaveCount(1);

    // Screenshot
    await argosScreenshot(page, 'results');
  });
});
