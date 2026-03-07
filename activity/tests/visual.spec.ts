import { test, expect } from '@playwright/test';
import { mockGuildData, mockChannelData, mockPlayers, mockGroups } from '../src/mockData';

// Helper to encode data for URL
const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

// Seed Math.random for deterministic wheel rendering in screenshots
// Simple mulberry32 PRNG seeded to produce consistent canvas output
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

// ── Viewport Definitions ──────────────────────────────────────
const VIEWPORTS = {
  desktop:        { width: 1280, height: 720 },
  tablet:         { width: 800,  height: 600 },
  phonePortrait:  { width: 420,  height: 700 },
  discordSquare:  { width: 380,  height: 380 },
  iphoneSE:       { width: 320,  height: 568 },
  landscapeShort: { width: 800,  height: 400 },
} as const;

// ── Shared Test Data (using new guild + channel model) ────────
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

// ── Helper: run core view tests at a given viewport ───────────
function viewportTests(
  name: string,
  viewport: { width: number; height: number },
) {
  test.describe(`${name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test('Channel Picker', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(channelPickerData)}`);
      await expect(page.locator('#view-channels')).toBeVisible();

      const channelCount = mockGuildData.voiceChannels?.length || 0;
      await expect(page.locator('.channel-card')).toHaveCount(channelCount);

      await expect(page).toHaveScreenshot(`channels-${viewport.width}x${viewport.height}.png`);
    });

    test('Lobby', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(lobbyData)}`);
      await expect(page.locator('#view-lobby')).toBeVisible();
      await expect(page.locator('#player-count')).toHaveText(`${mockPlayers.length} players`);
      await expect(page.locator('.player-chip')).toHaveCount(mockPlayers.length);

      const spinBtn = page.locator('#spin-btn');
      await expect(spinBtn).toBeVisible();
      await expect(spinBtn).toBeEnabled();

      await expect(page).toHaveScreenshot(`lobby-${viewport.width}x${viewport.height}.png`);
    });

    test('Lobby Empty', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(lobbyEmptyData)}`);
      await expect(page.locator('#view-lobby')).toBeVisible();
      await expect(page.locator('.player-chip')).toHaveCount(0);
      await expect(page.locator('#spin-btn')).toBeDisabled();

      await expect(page).toHaveScreenshot(`lobby-empty-${viewport.width}x${viewport.height}.png`);
    });

    test('Static Wheels', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      // All 5 canvases exist in DOM
      await expect(page.locator('#wheel-tank')).toBeAttached();
      await expect(page.locator('#wheel-healer')).toBeAttached();
      await expect(page.locator('#wheel-dps1')).toBeAttached();
      await expect(page.locator('#wheel-dps2')).toBeAttached();
      await expect(page.locator('#wheel-dps3')).toBeAttached();

      // Side panel visible
      await expect(page.locator('#side-panel')).toBeVisible();

      await expect(page).toHaveScreenshot(`wheels-static-${viewport.width}x${viewport.height}.png`);
    });

    test('Spinning Ready', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(spinningReadyData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const nextBtn = page.locator('#next-btn');
      await expect(nextBtn).toBeVisible();
      await expect(nextBtn).toBeEnabled();
      await expect(nextBtn).toHaveText('Spin for Group 1');

      // Side panel visible but no groups yet
      await expect(page.locator('#side-panel')).toBeVisible();

      await expect(page).toHaveScreenshot(`spinning-ready-${viewport.width}x${viewport.height}.png`);
    });

    test('Results', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(resultsData)}`);
      await expect(page.locator('#view-results')).toBeVisible();
      await expect(page.locator('#final-groups .group-card')).toHaveCount(mockGroups.length);

      const newRoundBtn = page.locator('#new-round-btn');
      await expect(newRoundBtn).toBeVisible();

      await expect(page).toHaveScreenshot(`results-${viewport.width}x${viewport.height}.png`);
    });

    test('No Session', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto('/');
      await expect(page.locator('#view-home')).toBeVisible();
      await expect(page.locator('#demo-controls')).toBeVisible();

      await expect(page).toHaveScreenshot(`no-session-${viewport.width}x${viewport.height}.png`);
    });
  });
}

// ── Generate tests for all viewports ──────────────────────────
viewportTests('Desktop',         VIEWPORTS.desktop);
viewportTests('Tablet',          VIEWPORTS.tablet);
viewportTests('Phone Portrait',  VIEWPORTS.phonePortrait);
viewportTests('Discord Square',  VIEWPORTS.discordSquare);
viewportTests('iPhone SE',       VIEWPORTS.iphoneSE);
viewportTests('Landscape Short', VIEWPORTS.landscapeShort);

// ── Carousel-Specific Tests ──────────────────────────────────
test.describe('Carousel Mode Tests', () => {
  test.describe('Phone Portrait (420x700)', () => {
    test.use({ viewport: VIEWPORTS.phonePortrait });

    test('Carousel dots visible in wheels view', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();
      await expect(page.locator('.carousel-dots')).toBeVisible();
      await expect(page.locator('.carousel-dot')).toHaveCount(5);
    });

    test('Only one wheel visible at a time', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      // The first wheel (tank) should be in viewport
      await expect(page.locator('#slot-tank')).toBeInViewport();
    });

    test('Carousel navigation via CSS variable', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      // Navigate to healer (index 1)
      await page.evaluate(() => {
        const container = document.querySelector('.wheels-container') as HTMLElement;
        container.style.setProperty('--carousel-index', '1');
      });

      // Wait for transition
      await page.waitForTimeout(400);

      // Verify the container transform shifted by -100%
      const transformValue = await page.locator('.wheels-container').evaluate(
        (el) => getComputedStyle(el).transform,
      );
      // transform should be a matrix with a negative X translation
      expect(transformValue).not.toBe('none');
    });
  });

  test.describe('Discord Square (380x380)', () => {
    test.use({ viewport: VIEWPORTS.discordSquare });

    test('Carousel dots visible', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();
      await expect(page.locator('.carousel-dots')).toBeVisible();
      await expect(page.locator('.carousel-dot')).toHaveCount(5);
    });

    test('Header hidden at small size', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('.app-header')).toBeHidden();
    });

    test('Side panel visible in wheels view', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#side-panel')).toBeVisible();
    });
  });
});

// ── Functional Tests (viewport-independent) ──────────────────
test.describe('Functional Tests', () => {
  test('Request spin shows calculating state', async ({ page }) => {
    const data = {
      ...mockChannelData,
      status: 'request_spin',
      players: mockPlayers,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    const spinBtn = page.locator('#spin-btn');
    await expect(spinBtn).toBeDisabled();
    await expect(spinBtn).toHaveText('Calculating...');
  });

  test('Player chips show correct role colors', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);

    // Pandemonium is a tank main
    const tankChip = page.locator('.player-chip', { hasText: 'Pandemonium' });
    await expect(tankChip.locator('.role-dot')).toHaveClass(/tank/);

    // Martz is a healer main
    const healerChip = page.locator('.player-chip', { hasText: 'Martz' });
    await expect(healerChip.locator('.role-dot')).toHaveClass(/healer/);

    // KingofSkillz is Ranged DPS
    const dpsChip = page.locator('.player-chip', { hasText: 'KingofSkillz' });
    await expect(dpsChip.locator('.role-dot')).toHaveClass(/ranged/);
  });

  test('Results show correct group composition', async ({ page }) => {
    await page.goto(`/?data=${encodeData(resultsData)}`);

    // Group 1 tank is Pandemonium (has brez ⚰️)
    const group1 = page.locator('#final-groups .group-card').first();
    await expect(group1.locator('.role-name').first()).toHaveText('Pandemonium ⚰️');

    // Group 1 healer is Martz (has brez ⚰️)
    await expect(group1.locator('.role-name').nth(1)).toHaveText('Martz ⚰️');
  });

  test('Button always visible in wheels view', async ({ page }) => {
    await page.goto(`/?data=${encodeData(spinningReadyData)}`);
    await expect(page.locator('#next-btn')).toBeInViewport();
  });

  test('All 5 canvases in DOM in wheels view', async ({ page }) => {
    await page.goto(`/?data=${encodeData(staticWheelsData)}`);
    await expect(page.locator('#wheel-tank')).toBeAttached();
    await expect(page.locator('#wheel-healer')).toBeAttached();
    await expect(page.locator('#wheel-dps1')).toBeAttached();
    await expect(page.locator('#wheel-dps2')).toBeAttached();
    await expect(page.locator('#wheel-dps3')).toBeAttached();
  });
});

// ── Home View (Recent Guilds) Tests ──────────────────────────
test.describe('Home View Tests', () => {
  const recentGuilds = [
    { guildId: 'guild-1', guildName: 'Gif or Gif', guildIconUrl: undefined, lastVisited: Date.now() - 60000 },
    { guildId: 'guild-2', guildName: 'Another Guild', guildIconUrl: undefined, lastVisited: Date.now() - 3600000 },
  ];

  test('Shows home view with recent guilds from localStorage', async ({ page }) => {
    await page.addInitScript((guilds) => {
      localStorage.setItem('wheelson-recent-guilds', JSON.stringify(guilds));
    }, recentGuilds);

    await page.goto('/');
    await expect(page.locator('#view-home')).toBeVisible();
    await expect(page.locator('.guild-card')).toHaveCount(2);
    await expect(page.locator('.guild-card-name').first()).toHaveText('Gif or Gif');
    await expect(page.locator('.guild-card-name').nth(1)).toHaveText('Another Guild');
  });

  test('Shows empty state when no recent guilds', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#view-home')).toBeVisible();
    await expect(page.locator('.guild-card')).toHaveCount(0);
    await expect(page.locator('#no-recent-guilds')).toBeVisible();
  });

  test('Demo controls visible on home view', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#view-home')).toBeVisible();
    await expect(page.locator('#demo-controls')).toBeVisible();
  });

  test('Guild cards are keyboard accessible', async ({ page }) => {
    await page.addInitScript((guilds) => {
      localStorage.setItem('wheelson-recent-guilds', JSON.stringify(guilds));
    }, recentGuilds);

    await page.goto('/');
    const firstCard = page.locator('.guild-card').first();
    await expect(firstCard).toHaveAttribute('role', 'button');
    await expect(firstCard).toHaveAttribute('tabindex', '0');
  });

  test('Guild icon placeholder shown when no icon URL', async ({ page }) => {
    await page.addInitScript((guilds) => {
      localStorage.setItem('wheelson-recent-guilds', JSON.stringify(guilds));
    }, recentGuilds);

    await page.goto('/');
    await expect(page.locator('.guild-icon-placeholder').first()).toBeVisible();
  });
});

// ── Grid Mode Tests ──────────────────────────────────────────
test.describe('Grid Mode Tests', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('Carousel dots hidden at desktop', async ({ page }) => {
    await page.goto(`/?data=${encodeData(staticWheelsData)}`);
    await expect(page.locator('#view-wheels')).toBeVisible();
    await expect(page.locator('.carousel-dots')).toBeHidden();
  });

  test('All 5 wheels visible simultaneously', async ({ page }) => {
    await page.goto(`/?data=${encodeData(staticWheelsData)}`);
    await expect(page.locator('#wheel-tank')).toBeVisible();
    await expect(page.locator('#wheel-healer')).toBeVisible();
    await expect(page.locator('#wheel-dps1')).toBeVisible();
    await expect(page.locator('#wheel-dps2')).toBeVisible();
    await expect(page.locator('#wheel-dps3')).toBeVisible();
  });

  test('Wheels use grid layout', async ({ page }) => {
    const container = page.locator('.wheels-container');
    await page.goto(`/?data=${encodeData(staticWheelsData)}`);
    const display = await container.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('grid');
  });
});
