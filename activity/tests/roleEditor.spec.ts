import { test, expect } from '@playwright/test';
import { mockChannelData, mockPlayers } from '../src/lib/mockData';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

const lobbyData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
};

test.describe('Player Modal Screenshots', () => {
  test.use({ viewport: { width: 600, height: 800 } });

  test('Click player chip opens modal', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    // Click on Pandemonium (tank)
    await page.locator('.player-chip', { hasText: 'Pandemonium' }).click();
    await expect(page.locator('#player-modal')).toBeVisible();
    await expect(page.locator('.player-modal-header h3')).toHaveText('Pandemonium');

    await expect(page).toHaveScreenshot('player-modal-tank.png');
  });

  test('Modal shows pre-selected roles for healer', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    // Click on Martz (healer main, off tank, off melee, brez)
    await page.locator('.player-chip', { hasText: 'Martz' }).click();
    await expect(page.locator('#player-modal')).toBeVisible();

    // Healer should be active in main spec
    await expect(page.locator('#player-modal [data-role-id="Healer"].active-healer')).toBeVisible();

    await expect(page).toHaveScreenshot('player-modal-healer.png');
  });

  test('Modal shows Lust active (Tytanium)', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    // Click on Tytanium (Ranged DPS, Healer Offspec, Lust)
    await page.locator('.player-chip', { hasText: 'Tytanium' }).click();
    await expect(page.locator('#player-modal')).toBeVisible();
    await expect(page.locator('#player-modal [data-role-id="Lust"].active-lust')).toBeVisible();

    await expect(page).toHaveScreenshot('player-modal-lust-active.png');
  });

  test('Modal shows in-game name when set', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    // Click on Tytanium who has inGameName set
    await page.locator('.player-chip', { hasText: 'Tytanium' }).click();
    await expect(page.locator('#player-modal')).toBeVisible();

    // Check in-game name input is pre-filled
    const input = page.locator('#player-modal .role-editor-input');
    await expect(input).toHaveValue('Tytanium-Proudmoore');
  });

  test('Escape closes modal', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip', { hasText: 'Pandemonium' }).click();
    await expect(page.locator('#player-modal')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#player-modal')).not.toBeVisible();
  });

  test('Backdrop click closes modal', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip', { hasText: 'Pandemonium' }).click();
    await expect(page.locator('#player-modal')).toBeVisible();

    // Click the backdrop (outside the modal dialog)
    await page.locator('.player-modal-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#player-modal')).not.toBeVisible();
  });

  test('Close button closes modal', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip', { hasText: 'Pandemonium' }).click();
    await expect(page.locator('#player-modal')).toBeVisible();

    await page.locator('.player-modal-close').click();
    await expect(page.locator('#player-modal')).not.toBeVisible();
  });

  test('Modal is centered and sized correctly', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip', { hasText: 'Pandemonium' }).click();
    await expect(page.locator('#player-modal')).toBeVisible();

    const modalBox = await page.locator('#player-modal').boundingBox();
    expect(modalBox).toBeTruthy();
    // Max-width is 400px, viewport is 600px, so modal should be ≤ 400px wide
    expect(modalBox!.width).toBeLessThanOrEqual(400);
    // Should be roughly centered horizontally
    const viewportWidth = 600;
    const leftMargin = modalBox!.x;
    const rightMargin = viewportWidth - (modalBox!.x + modalBox!.width);
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(10);
  });

  test('Player chips are keyboard accessible', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    const firstChip = page.locator('.player-chip').first();
    await expect(firstChip).toHaveAttribute('role', 'button');
    await expect(firstChip).toHaveAttribute('tabindex', '0');
  });
});
