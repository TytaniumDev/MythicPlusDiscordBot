import { test, expect } from './fixtures';
import { mockChannelData, mockPlayers } from '../src/lib/mockData';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

// Use Gazzi (index 4) as identity — has mainRole + inGameName so isPlayerReady passes
const lobbyIdentity = { id: mockPlayers[4].discordId, name: mockPlayers[4].name };

const lobbyData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
  identity: lobbyIdentity,
};

test.describe('CharacterCard Inline Editor', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Character card visible in lobby sidebar', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    const playerCard = page.locator('[data-testid="character-card"]');
    await expect(playerCard).toBeVisible();

    // Full-body render of the character
    await expect(playerCard.getByAltText(`${mockPlayers[4].inGameName}, full-body render`)).toBeVisible();

    await expect(page).toHaveScreenshot('player-card-sidebar.png');
  });

  test('Character card shows role buttons', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip').first().click();
    const playerCard = page.locator('[data-testid="character-card"]');

    // Main spec section exists
    const mainSpecLabel = playerCard.locator('.role-editor-label', { hasText: 'Main Spec' });
    await expect(mainSpecLabel).toBeVisible();

    // Role buttons exist
    await expect(playerCard.locator('[data-role-id="Tank"]')).toBeVisible();
    await expect(playerCard.locator('[data-role-id="Healer"]')).toBeVisible();
    await expect(playerCard.locator('[data-role-id="Ranged"]')).toBeVisible();
    await expect(playerCard.locator('[data-role-id="Melee"]')).toBeVisible();
  });

  test('Character card shows offspec and utility sections', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip').first().click();
    const playerCard = page.locator('[data-testid="character-card"]');

    await expect(playerCard.locator('.role-editor-label', { hasText: 'Offspec' })).toBeVisible();
    await expect(playerCard.locator('.role-editor-label', { hasText: 'Utilities' })).toBeVisible();
    await expect(playerCard.locator('[data-role-id="Brez"]')).toBeVisible();
    await expect(playerCard.locator('[data-role-id="Lust"]')).toBeVisible();
  });

  test('Character card has in-game name input', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    await page.locator('.player-chip').first().click();
    const playerCard = page.locator('[data-testid="character-card"]');
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

  test('Character card on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    // Tapping your own chip opens the editor in the card
    await page.locator('.player-chip').first().click();
    const playerCard = page.locator('[data-testid="character-card"]');
    await expect(playerCard.locator('.role-editor-input')).toBeVisible();
    await expect(playerCard).not.toHaveClass(/character-card--highlight/);

    await expect(page).toHaveScreenshot('player-card-mobile-lobby.png');
  });
});
