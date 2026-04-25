import { test, expect, type Page } from '@playwright/test';
import { mockChannelData, mockPlayers, mockGroups } from '../src/lib/mockData';
import { mockRaiderio } from './helpers/raiderio';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

const resultsData = {
  ...mockChannelData,
  status: 'completed',
  players: mockPlayers,
  groups: mockGroups,
};

async function mockRaiderioFailure(page: Page) {
  await page.route('https://raider.io/api/v1/characters/profile**', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
}

test.describe('Dungeon Suggestions panel', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('renders ranked suggestions when raider.io returns data', async ({ page }) => {
    await mockRaiderio(page);
    await page.goto(`/?data=${encodeData(resultsData)}`);
    await expect(page.locator('#view-results')).toBeVisible();

    const panel = page.locator('.dungeon-suggestions');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: /Suggested Keys/i })).toBeVisible();

    // Wait for ready state — the footnote ("Based on N characters") only
    // renders once requests resolve and ranking is computed.
    await expect(panel.locator('.dungeon-suggestions__footnote')).toBeVisible();

    const rows = panel.locator('.dungeon-suggestion-row:not(.dungeon-suggestion-row--skeleton)');
    // FLOOD should rank #1 — it's the lowest-scoring dungeon in the fixture.
    await expect(rows.first().locator('.dungeon-suggestion-row__name')).toHaveText('FLOOD');
    // Default limit is 5 dungeons.
    await expect(rows).toHaveCount(5);

    await expect(panel).toHaveScreenshot('dungeon-suggestions-ready.png');
  });

  test('renders error message when raider.io returns 5xx for every character', async ({ page }) => {
    await mockRaiderioFailure(page);
    await page.goto(`/?data=${encodeData(resultsData)}`);
    await expect(page.locator('#view-results')).toBeVisible();

    const panel = page.locator('.dungeon-suggestions');
    // 'error' state shows the connectivity-specific message, distinct from
    // the "no runs" empty state. Asserting the text guards against the bug
    // where service failures silently render as "no runs on file".
    await expect(panel.locator('.dungeon-suggestions__empty')).toContainText(/Couldn't reach Raider\.io/i);
  });

  test('renders empty-state when no players have a parseable inGameName', async ({ page }) => {
    await mockRaiderio(page);
    const noLinkedPlayers = mockPlayers.map(p => ({ ...p, inGameName: undefined }));
    const data = {
      ...resultsData,
      players: noLinkedPlayers,
      groups: mockGroups,
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#view-results')).toBeVisible();

    const panel = page.locator('.dungeon-suggestions');
    await expect(panel.locator('.dungeon-suggestions__empty')).toContainText(/Link characters/i);
  });
});
