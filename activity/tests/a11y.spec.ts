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
