import { test, expect } from '@playwright/test';
import { mockGuildData, mockChannelData, mockPlayers, mockGroups } from '../src/lib/mockData';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

// Seed Math.random for deterministic rendering
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

// Default viewport for component tests
test.use({ viewport: { width: 1280, height: 800 } });

// ── Component: HeaderBar ─────────────────────────────────────
test.describe('Component: HeaderBar', () => {
  test('Home header (no back button)', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    await page.goto('/');
    await expect(page.locator('#view-home')).toBeVisible();
    const header = page.locator('.header-bar').first();
    await expect(header).toBeVisible();
    await expect(header).toHaveScreenshot('header-bar-home.png');
  });

  test('Channels header (with back button)', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    await page.goto(`/?data=${encodeData(mockGuildData)}`);
    await expect(page.locator('#view-channels')).toBeVisible();
    const header = page.locator('.header-bar').first();
    await expect(header).toBeVisible();
    await expect(header).toHaveScreenshot('header-bar-channels.png');
  });

  test('Results header (gold title)', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    const resultsData = { ...mockChannelData, status: 'completed', players: mockPlayers, groups: mockGroups };
    await page.goto(`/?data=${encodeData(resultsData)}`);
    await expect(page.locator('#view-results')).toBeVisible();
    const header = page.locator('.header-bar').first();
    await expect(header).toBeVisible();
    await expect(header).toHaveScreenshot('header-bar-results.png');
  });
});

// ── Component: GuildCard ─────────────────────────────────────
test.describe('Component: GuildCard', () => {
  const recentGuilds = [
    { guildId: 'guild-1', guildName: 'Mythic Monday', guildIconUrl: undefined, lastVisited: Date.now() - 7200000 },
  ];

  test('Guild card appearance', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    await page.addInitScript((guilds) => {
      localStorage.setItem('wheelson-recent-guilds', JSON.stringify(guilds));
    }, recentGuilds);

    await page.goto('/');
    await expect(page.locator('#view-home')).toBeVisible();
    const card = page.locator('.guild-card').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveScreenshot('guild-card.png');
  });
});

// ── Component: ChannelCard ───────────────────────────────────
test.describe('Component: ChannelCard', () => {
  test('Channel card with user count', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    await page.goto(`/?data=${encodeData(mockGuildData)}`);
    await expect(page.locator('#view-channels')).toBeVisible();
    const card = page.locator('.channel-card').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveScreenshot('channel-card.png');
  });
});

// ── Component: PlayerChip ────────────────────────────────────
test.describe('Component: PlayerChip', () => {
  test('Player chips in lobby', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    const lobbyData = { ...mockChannelData, status: 'lobby', players: mockPlayers };
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    // Tank player chip
    const tankChip = page.locator('.player-chip').first();
    await expect(tankChip).toBeVisible();
    await expect(tankChip).toHaveScreenshot('player-chip-tank.png');
  });
});

// ── Component: RoleSectionHeader ─────────────────────────────
test.describe('Component: RoleSectionHeader', () => {
  test('Role section headers in lobby', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    const lobbyData = { ...mockChannelData, status: 'lobby', players: mockPlayers };
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    const header = page.locator('.role-section-header').first();
    await expect(header).toBeVisible();
    await expect(header).toHaveScreenshot('role-section-header.png');
  });
});

// ── Component: GroupCard ─────────────────────────────────────
test.describe('Component: GroupCard', () => {
  test('Group card in results', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    const resultsData = { ...mockChannelData, status: 'completed', players: mockPlayers, groups: mockGroups };
    await page.goto(`/?data=${encodeData(resultsData)}`);
    await expect(page.locator('#view-results')).toBeVisible();
    const card = page.locator('.group-card').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveScreenshot('group-card.png');
  });
});

// ── Component: PlayerCard ────────────────────────────────────
test.describe('Component: PlayerCard', () => {
  test('Player card in lobby sidebar', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    const lobbyData = { ...mockChannelData, status: 'lobby', players: mockPlayers };
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    const card = page.locator('[data-testid="player-card"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveScreenshot('player-card.png');
  });

  test('Player card on mobile (via drawer)', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    const lobbyData = { ...mockChannelData, status: 'lobby', players: mockPlayers };
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    // Expand the mobile drawer to reveal the player card
    await page.locator('.mobile-drawer__header').click();
    await expect(page.locator('.mobile-drawer--expanded')).toBeVisible();

    const card = page.locator('[data-testid="player-card"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveScreenshot('player-card-mobile.png');
  });
});

// ── Component: PrimaryCTA Button ─────────────────────────────
test.describe('Component: PrimaryCTA', () => {
  test('Spin button appearance', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    const lobbyData = { ...mockChannelData, status: 'lobby', players: mockPlayers };
    await page.goto(`/?data=${encodeData(lobbyData)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    const btn = page.locator('#spin-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveScreenshot('primary-cta-spin.png');
  });

  test('Disabled state', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    const emptyLobby = { ...mockChannelData, status: 'lobby', players: [] };
    await page.goto(`/?data=${encodeData(emptyLobby)}`);
    await expect(page.locator('#view-lobby')).toBeVisible();

    const btn = page.locator('#spin-btn');
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveScreenshot('primary-cta-disabled.png');
  });
});

// ── Component: SecondaryButton ───────────────────────────────
test.describe('Component: SecondaryButton', () => {
  test('New Round button', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    const resultsData = { ...mockChannelData, status: 'completed', players: mockPlayers, groups: mockGroups };
    await page.goto(`/?data=${encodeData(resultsData)}`);
    await expect(page.locator('#view-results')).toBeVisible();

    const btn = page.locator('#new-round-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveScreenshot('secondary-btn-new-round.png');
  });
});

// ── Component: Checkbox ──────────────────────────────────────
test.describe('Component: Checkbox', () => {
  test('Announce checkbox in wheels view', async ({ page }) => {
    await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
    const wheelsData = { ...mockChannelData, status: 'spinning', staticWheel: true, players: mockPlayers };
    await page.goto(`/?data=${encodeData(wheelsData)}`);
    await expect(page.locator('#view-wheels')).toBeVisible();

    const checkbox = page.locator('.announce-option');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toHaveScreenshot('checkbox-announce.png');
  });
});
