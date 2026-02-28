import { test, expect } from '@playwright/test';
import { mockSession, mockPlayers } from '../src/mockData';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

const staticWheelsData = {
  ...mockSession,
  status: 'spinning',
  staticWheel: true,
  selectedChannelId: 'vc-1',
  players: mockPlayers,
};

test('Wheels have accessible attributes', async ({ page }) => {
  // Use static wheel mode to inspect initial state
  await page.goto(`/?data=${encodeData(staticWheelsData)}`);

  // Verify Tank Wheel
  const tankCanvas = page.locator('#wheel-tank');
  await expect(tankCanvas).toHaveAttribute('role', 'img');

  // It should contain the label and candidate count
  const label = await tankCanvas.getAttribute('aria-label');
  expect(label).not.toBeNull();
  expect(label).toContain('Tank Selection Wheel');
  expect(label).toMatch(/\d+ candidates/);
});

test('Wheel result container has aria-live', async ({ page }) => {
  await page.goto(`/?data=${encodeData(staticWheelsData)}`);
  const resultContainer = page.locator('#result-tank');
  await expect(resultContainer).toHaveAttribute('aria-live', 'polite');
});

test('Lobby player chips have accessible role indicators', async ({ page }) => {
  const lobbyData = { ...mockSession, status: 'lobby', players: mockPlayers, selectedChannelId: 'vc-1' };
  await page.goto(`/?data=${encodeData(lobbyData)}`);

  const firstChipDot = page.locator('.player-chip .role-dot').first();
  await expect(firstChipDot).toHaveAttribute('role', 'img');

  // Check for one of the valid role labels
  const label = await firstChipDot.getAttribute('aria-label');
  expect(label).toBeTruthy();
  expect(['Tank', 'Healer', 'DPS']).toContain(label);

  await expect(firstChipDot).toHaveAttribute('title', label as string);
});

test('Clicking Wheelson header navigates back to home', async ({ page }) => {
  const lobbyData = { ...mockSession, status: 'lobby', players: mockPlayers, selectedChannelId: 'vc-1' };
  await page.goto(`/?data=${encodeData(lobbyData)}`);

  // Verify we're in the lobby view
  await expect(page.locator('#view-lobby')).toBeVisible();
  await expect(page.locator('#view-home')).toBeHidden();

  // Click the Wheelson header
  await page.locator('.app-header h1').click();

  // Should navigate back to home view
  await expect(page.locator('#view-home')).toBeVisible();
  await expect(page.locator('#view-lobby')).toBeHidden();
});
