import { test, expect } from '@playwright/test';
import { mockChannelData, mockPlayers } from '../src/mockData';
import type { WoWPlayer } from '../src/types';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

// A player with zero roles — role editor should auto-show for them
const noRolesPlayer: WoWPlayer = {
  name: 'Newbie',
  discordId: '100000000000000099',
  roles: {
    tankMain: false,
    healerMain: false,
    dpsMain: false,
    offtank: false,
    offhealer: false,
    offdps: false,
    offranged: false,
    offmelee: false,
    ranged: false,
    melee: false,
    hasBrez: false,
    hasLust: false,
  },
};

const lobbyData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
};

const lobbyWithNoRolesPlayer = {
  ...mockChannelData,
  status: 'lobby',
  players: [noRolesPlayer, ...mockPlayers],
};

test.describe('Role Editor Screenshots', () => {
  test.use({ viewport: { width: 600, height: 800 } });

  test('Identity selector — Who are you?', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();
    // No Discord SDK → manual identity selector shown
    await expect(page.locator('.identity-label')).toHaveText('Who are you?');
    await expect(page.locator('.identity-chips .identity-chip')).toHaveCount(mockPlayers.length);

    await expect(page).toHaveScreenshot('role-editor-identity-selector.png');
  });

  test('Identity confirmed — player with roles (editor hidden)', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();
    await expect(page.locator('.identity-chips')).toBeVisible();

    // Select Pandemonium (tank main — has roles)
    await page.locator('.identity-chip', { hasText: 'Pandemonium' }).click();

    // Identity confirmed row + Change Roles button visible
    await expect(page.locator('.identity-name')).toHaveText('Pandemonium');
    await expect(page.locator('.btn-change-roles')).toHaveText('Change Roles');
    // Role editor should be hidden (player has roles)
    await expect(page.locator('#role-editor')).toBeHidden();

    await expect(page).toHaveScreenshot('role-editor-hidden-has-roles.png');
  });

  test('Identity confirmed — player without roles (editor auto-shown)', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyWithNoRolesPlayer)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();
    await expect(page.locator('.identity-chips')).toBeVisible();

    // Select Newbie (no roles)
    await page.locator('.identity-chip', { hasText: 'Newbie' }).click();

    await expect(page.locator('.identity-name')).toHaveText('Newbie');
    await expect(page.locator('.btn-change-roles')).toHaveText('Hide Roles');
    // Role editor should be visible (player has no roles)
    await expect(page.locator('#role-editor')).toBeVisible();

    await expect(page).toHaveScreenshot('role-editor-auto-shown-no-roles.png');
  });

  test('Change Roles button toggles editor open', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();
    await expect(page.locator('.identity-chips')).toBeVisible();

    // Select Martz (healer — has roles)
    await page.locator('.identity-chip', { hasText: 'Martz' }).click();
    await expect(page.locator('#role-editor')).toBeHidden();

    // Click "Change Roles" to open editor
    await page.locator('.btn-change-roles').click();
    await expect(page.locator('#role-editor')).toBeVisible();
    await expect(page.locator('.btn-change-roles')).toHaveText('Hide Roles');

    await expect(page).toHaveScreenshot('role-editor-toggled-open.png');
  });

  test('Role editor width is self-contained (not full width)', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyWithNoRolesPlayer)}`);
    await expect(page.locator('.identity-chips')).toBeVisible();

    // Select Newbie so the editor auto-shows
    await page.locator('.identity-chip', { hasText: 'Newbie' }).click();
    await expect(page.locator('#role-editor')).toBeVisible();

    // Editor should be narrower than its parent (lobby is 600px viewport)
    const editorBox = await page.locator('#role-editor').boundingBox();
    const lobbyBox = await page.locator('#view-lobby').boundingBox();
    expect(editorBox).toBeTruthy();
    expect(lobbyBox).toBeTruthy();
    expect(editorBox!.width).toBeLessThan(lobbyBox!.width);
    // Should be centered (left margin ≈ right margin)
    const leftMargin = editorBox!.x - lobbyBox!.x;
    const rightMargin = (lobbyBox!.x + lobbyBox!.width) - (editorBox!.x + editorBox!.width);
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(10);
  });
});
