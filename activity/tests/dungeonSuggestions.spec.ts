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
    // Operation: Floodgate should rank #1 — it's the lowest-scoring dungeon
    // in the fixture. We display the full name; the row text matches that.
    await expect(rows.first().locator('.dungeon-suggestion-row__name'))
      .toHaveText('Operation: Floodgate');
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

  test('hovering a spotlight portrait shows that character\'s M+ scores', async ({ page }) => {
    await mockRaiderio(page);
    const dataWithIdentity = {
      ...resultsData,
      identity: { id: mockPlayers[4].discordId, name: mockPlayers[4].name },
    };
    await page.goto(`/?data=${encodeData(dataWithIdentity)}`);
    await expect(page.locator('#view-results')).toBeVisible();
    await expect(page.locator('.spotlight-portrait')).toHaveCount(5);

    // Wait for character data to settle so the tooltip has scores to show.
    await expect(page.locator('.dungeon-suggestions__footnote')).toBeVisible();

    const firstPortrait = page.locator('.spotlight-portrait').first();
    const tooltip = firstPortrait.locator('.spotlight-portrait__tooltip');
    // Hidden by default, but DOM-present so it's visible to assistive tech.
    await expect(tooltip).toBeAttached();

    await firstPortrait.hover();
    await expect(tooltip).toBeVisible();
    // Includes overall RIO + per-dungeon list seeded from the fixture.
    await expect(tooltip).toContainText(/RIO/);
    await expect(tooltip.locator('.spotlight-portrait__tooltip-row')).toHaveCount(8);
  });

  test('renders empty-state when no players have a parseable inGameName', async ({ page }) => {
    await mockRaiderio(page);
    const stripInGameName = (p: typeof mockPlayers[number]) => ({ ...p, inGameName: undefined });
    const noLinkedPlayers = mockPlayers.map(stripInGameName);
    // Suggestions are scoped to the group's players (or all-grouped fallback),
    // not the lobby pool — so groups must also reference name-less copies for
    // this empty-state assertion to hold.
    const noLinkedGroups = mockGroups.map(g => ({
      tank: g.tank ? stripInGameName(g.tank) : null,
      healer: g.healer ? stripInGameName(g.healer) : null,
      dps: g.dps.map(stripInGameName),
    }));
    const data = {
      ...resultsData,
      players: noLinkedPlayers,
      groups: noLinkedGroups,
    };
    await page.goto(`/?data=${encodeData(data)}`);
    await expect(page.locator('#view-results')).toBeVisible();

    const panel = page.locator('.dungeon-suggestions');
    await expect(panel.locator('.dungeon-suggestions__empty')).toContainText(/Link characters/i);
  });
});
