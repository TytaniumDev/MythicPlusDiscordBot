import { test, expect } from '@playwright/test';
import { mockGuildData, mockChannelData, mockPlayers, mockGroups } from '../src/lib/mockData';
import { mockRaiderio } from './helpers/raiderio';

test.beforeEach(async ({ page }) => {
  await mockRaiderio(page);
});

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

// Use Gazzi (index 4) as identity — has mainRole + inGameName so isPlayerReady passes
const lobbyIdentity = { id: mockPlayers[4].discordId, name: mockPlayers[4].name };

const lobbyData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
  identity: lobbyIdentity,
};

const lobbyEmptyData = {
  ...mockChannelData,
  status: 'lobby',
  players: [],
  identity: { id: 'test-user', name: 'TestUser' },
};

const lobbySittingOutData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
  sittingOut: [mockPlayers[5].discordId, mockPlayers[7].discordId],
  identity: lobbyIdentity,
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

    test('Identity View', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      const identityData = {
        ...mockChannelData,
        status: 'lobby',
        players: mockPlayers,
        // No identity — will show identity picker
      };
      await page.goto(`/?data=${encodeData(identityData)}`);
      await expect(page.locator('#view-identity')).toBeVisible();
      await expect(page).toHaveScreenshot(`identity-${viewport.width}x${viewport.height}.png`);
    });

    test('Setup View', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      // Strip inGameName from [0] so isPlayerReady fails and we land on setup.
      const setupPlayers = mockPlayers.map((p, i) =>
        i === 0 ? { ...p, inGameName: undefined } : p,
      );
      const setupData = {
        ...mockChannelData,
        status: 'lobby',
        players: setupPlayers,
        identity: { id: setupPlayers[0].discordId, name: setupPlayers[0].name },
      };
      await page.goto(`/?data=${encodeData(setupData)}`);
      await expect(page.locator('#view-setup')).toBeVisible();
      await expect(page).toHaveScreenshot(`setup-${viewport.width}x${viewport.height}.png`);
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
      await expect(page.locator('.group-carousel .group-slide')).toHaveCount(mockGroups.length);
      // Wait for dungeon suggestions to settle into ready state.
      await expect(
        page.locator('.dungeon-suggestion-row:not(.dungeon-suggestion-row--skeleton)').first(),
      ).toBeVisible();
      await expect(page).toHaveScreenshot(`results-${viewport.width}x${viewport.height}.png`);
    });
  });
}

// ── Generate tests for all 3 design viewports ───────────────
designViewportTests('Desktop', DESIGN_VIEWPORTS.desktop);
designViewportTests('Tablet',  DESIGN_VIEWPORTS.tablet);
designViewportTests('Mobile',  DESIGN_VIEWPORTS.mobile);

// ── Mobile-specific functional tests ────────────────────────
test.describe('Mobile Functional (393x852)', () => {
  test.use({ viewport: DESIGN_VIEWPORTS.mobile });

  test('Lobby — drawer footer is visible and player list is scrollable', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    // Click a player chip to select them
    await page.locator('.player-chip').first().click();

    // Drawer footer should be visible
    await expect(page.locator('.mobile-drawer')).toBeVisible();
    await expect(page.locator('.mobile-drawer__name')).toBeVisible();

    // Spin button should be visible (not pushed off-screen)
    await expect(page.locator('#spin-btn')).toBeVisible();
    await expect(page.locator('#spin-btn')).toBeInViewport();

    // Player list should be visible
    await expect(page.locator('#player-list')).toBeVisible();

    await expect(page).toHaveScreenshot('lobby-mobile-drawer-collapsed.png');
  });

  test('Lobby — drawer expands and collapses', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    // Click a player chip to select them
    await page.locator('.player-chip').first().click();
    await expect(page.locator('.mobile-drawer')).toBeVisible();

    // Expand drawer
    await page.locator('.mobile-drawer__header').click();
    await expect(page.locator('.mobile-drawer--expanded')).toBeVisible();
    await expect(page.locator('[data-testid="player-card"]')).toBeVisible();

    // Collapse by clicking header again
    await page.locator('.mobile-drawer__header').click();
    await expect(page.locator('.mobile-drawer--expanded')).not.toBeVisible();
  });

  test('Lobby — drawer collapses on backdrop click', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    await page.goto(`/?data=${encodeData(lobbyData)}`);

    // Click a player chip to select them
    await page.locator('.player-chip').first().click();

    // Expand drawer
    await page.locator('.mobile-drawer__header').click();
    await expect(page.locator('.mobile-drawer--expanded')).toBeVisible();

    // Click backdrop to collapse
    await page.locator('.drawer-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.mobile-drawer--expanded')).not.toBeVisible();
  });

  test('Wheels — group pager appears below wheel, side column hidden', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    await page.goto(`/?data=${encodeData(spinningReadyData)}`);
    await expect(page.locator('#view-wheels')).toBeVisible();

    // Side column should NOT be visible on mobile
    await expect(page.locator('.side-column')).not.toBeVisible();

    // Spin button should be visible
    await expect(page.locator('#next-btn')).toBeVisible();

    await expect(page).toHaveScreenshot('wheels-mobile-ready.png');
  });
});
