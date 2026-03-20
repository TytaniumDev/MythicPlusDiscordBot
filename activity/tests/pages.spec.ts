import { test, expect } from '@playwright/test';
import { mockGuildData, mockChannelData, mockPlayers, mockGroups } from '../src/lib/mockData';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

// Seed Math.random for deterministic wheel rendering
const DETERMINISTIC_RANDOM_SCRIPT = `
  (() => {
    let seed = 42;
    Math.random = () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  })();
`;

// ── Design Viewport Sizes (matching .pen file) ──────────────
const DESIGN_VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet:  { width: 1101, height: 838 },
  mobile:  { width: 393,  height: 852 },
} as const;

// ── Test Data ────────────────────────────────────────────────
const channelPickerData = mockGuildData;

const lobbyData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
};

const lobbyEmptyData = {
  ...mockChannelData,
  status: 'lobby',
  players: [],
};

const lobbySittingOutData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
  sittingOut: [mockPlayers[5].discordId, mockPlayers[7].discordId],
};

const staticWheelsData = {
  ...mockChannelData,
  status: 'spinning',
  staticWheel: true,
  players: mockPlayers,
};

const spinningReadyData = {
  ...mockChannelData,
  status: 'spinning',
  players: mockPlayers,
  groups: mockGroups,
};

const resultsData = {
  ...mockChannelData,
  status: 'completed',
  players: mockPlayers,
  groups: mockGroups,
};

// ── Recent guilds for Home view ──────────────────────────────
const recentGuilds = [
  { guildId: 'guild-1', guildName: 'Mythic Monday', guildIconUrl: undefined, lastVisited: Date.now() - 7200000 },
  { guildId: 'guild-2', guildName: 'Pushing Keys', guildIconUrl: undefined, lastVisited: Date.now() - 86400000 },
  { guildId: 'guild-3', guildName: 'Weekend Warriors', guildIconUrl: undefined, lastVisited: Date.now() - 259200000 },
];

// ── Helper: Generate tests for a single viewport ────────────
function designViewportTests(
  vpName: string,
  viewport: { width: number; height: number },
) {
  test.describe(`${vpName} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test('Home View — with guilds', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.addInitScript((guilds) => {
        localStorage.setItem('wheelson-recent-guilds', JSON.stringify(guilds));
      }, recentGuilds);

      await page.goto('/');
      await expect(page.locator('#view-home')).toBeVisible();
      await expect(page.locator('.guild-card')).toHaveCount(3);
      await expect(page).toHaveScreenshot(`home-guilds-${viewport.width}x${viewport.height}.png`);
    });

    test('Home View — empty', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto('/');
      await expect(page.locator('#view-home')).toBeVisible();
      await expect(page).toHaveScreenshot(`home-empty-${viewport.width}x${viewport.height}.png`);
    });

    test('Channels View', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(channelPickerData)}`);
      await expect(page.locator('#view-channels')).toBeVisible();

      const channelCount = mockGuildData.voiceChannels?.length || 0;
      await expect(page.locator('.channel-card')).toHaveCount(channelCount);
      await expect(page).toHaveScreenshot(`channels-${viewport.width}x${viewport.height}.png`);
    });

    test('Lobby View — with players', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(lobbyData)}`);
      await expect(page.locator('#view-lobby')).toBeVisible();
      await expect(page.locator('.player-chip')).toHaveCount(mockPlayers.length);
      await expect(page).toHaveScreenshot(`lobby-${viewport.width}x${viewport.height}.png`);
    });

    test('Lobby View — empty', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(lobbyEmptyData)}`);
      await expect(page.locator('#view-lobby')).toBeVisible();
      await expect(page).toHaveScreenshot(`lobby-empty-${viewport.width}x${viewport.height}.png`);
    });

    test('Lobby View — sitting out', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(lobbySittingOutData)}`);
      await expect(page.locator('#view-lobby')).toBeVisible();
      await expect(page).toHaveScreenshot(`lobby-sitting-out-${viewport.width}x${viewport.height}.png`);
    });

    test('Wheels View — static', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();
      await expect(page.locator('#wheel-tank')).toBeAttached();
      await expect(page).toHaveScreenshot(`wheels-static-${viewport.width}x${viewport.height}.png`);
    });

    test('Wheels View — spinning ready', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(spinningReadyData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();
      await expect(page.locator('#next-btn')).toBeVisible();
      await expect(page).toHaveScreenshot(`wheels-ready-${viewport.width}x${viewport.height}.png`);
    });

    test('Results View', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(resultsData)}`);
      await expect(page.locator('#view-results')).toBeVisible();
      await expect(page.locator('#final-groups .group-card')).toHaveCount(mockGroups.length);
      await expect(page).toHaveScreenshot(`results-${viewport.width}x${viewport.height}.png`);
    });
  });
}

// ── Generate tests for all 3 design viewports ───────────────
designViewportTests('Desktop', DESIGN_VIEWPORTS.desktop);
designViewportTests('Tablet',  DESIGN_VIEWPORTS.tablet);
designViewportTests('Mobile',  DESIGN_VIEWPORTS.mobile);
