import { test, expect } from '@playwright/test';
import { mockChannelData, mockPlayers } from '../src/lib/mockData';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

const lobbyData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
};

test.describe('PlayerCard Inline Editor', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('PlayerCard visible in lobby sidebar', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    // Click a player chip to select them and show the PlayerCard
    await page.locator('.player-chip').first().click();

    const playerCard = page.locator('[data-testid="player-card"]');
    await expect(playerCard).toBeVisible();

    // Character header name visible
    await expect(playerCard.locator('.character-header__name')).toBeVisible();

    await expect(page).toHaveScreenshot('player-card-sidebar.png');
  });

  test('PlayerCard shows role buttons', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip').first().click();
    const playerCard = page.locator('[data-testid="player-card"]');

    // Main spec section exists
    const mainSpecLabel = playerCard.locator('.role-editor-label', { hasText: 'Main Spec' });
    await expect(mainSpecLabel).toBeVisible();

    // Role buttons exist
    await expect(playerCard.locator('[data-role-id="Tank"]')).toBeVisible();
    await expect(playerCard.locator('[data-role-id="Healer"]')).toBeVisible();
    await expect(playerCard.locator('[data-role-id="Ranged"]')).toBeVisible();
    await expect(playerCard.locator('[data-role-id="Melee"]')).toBeVisible();
  });

  test('PlayerCard shows offspec and utility sections', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip').first().click();
    const playerCard = page.locator('[data-testid="player-card"]');

    await expect(playerCard.locator('.role-editor-label', { hasText: 'Offspec' })).toBeVisible();
    await expect(playerCard.locator('.role-editor-label', { hasText: 'Utilities' })).toBeVisible();
    await expect(playerCard.locator('[data-role-id="Brez"]')).toBeVisible();
    await expect(playerCard.locator('[data-role-id="Lust"]')).toBeVisible();
  });

  test('PlayerCard has in-game name input', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip').first().click();
    const playerCard = page.locator('[data-testid="player-card"]');
    const input = playerCard.locator('.role-editor-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'PlayerName-ServerName');
  });

  test('Player chips are keyboard accessible', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    const firstChip = page.locator('.player-chip').first();
    await expect(firstChip).toHaveAttribute('role', 'button');
    await expect(firstChip).toHaveAttribute('tabindex', '0');
  });

  test('PlayerCard on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip').first().click();
    const playerCard = page.locator('[data-testid="player-card"]');
    await expect(playerCard).toBeVisible();

    await expect(page).toHaveScreenshot('player-card-mobile-lobby.png');
  });
});
