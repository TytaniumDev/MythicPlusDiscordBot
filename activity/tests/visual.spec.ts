import { test, expect } from '@playwright/test';
import { mockSession, mockPlayers, mockGroups } from '../src/mockData';

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

// ── Shared Test Data ──────────────────────────────────────────
const channelPickerData = {
  ...mockSession,
  status: 'lobby',
  selectedChannelId: null,
};

const lobbyData = {
  ...mockSession,
  status: 'lobby',
  selectedChannelId: 'vc-1',
  players: mockPlayers,
};

const lobbyEmptyData = {
  ...mockSession,
  status: 'lobby',
  selectedChannelId: 'vc-1',
  players: [],
};

const staticWheelsData = {
  ...mockSession,
  status: 'spinning',
  staticWheel: true,
  selectedChannelId: 'vc-1',
  players: mockPlayers,
};

const spinningReadyData = {
  ...mockSession,
  status: 'spinning',
  selectedChannelId: 'vc-1',
  players: mockPlayers,
  groups: mockGroups,
};

const resultsData = {
  ...mockSession,
  status: 'completed',
  selectedChannelId: 'vc-1',
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

      const channelCount = mockSession.voiceChannels?.length || 0;
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
      await expect(page.locator('#status-message')).toHaveText(
        'No Guild/Session ID found. Try the Demo below.'
      );
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
      ...mockSession,
      status: 'request_spin',
      selectedChannelId: 'vc-1',
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

    // KingofSkillz is DPS main
    const dpsChip = page.locator('.player-chip', { hasText: 'KingofSkillz' });
    await expect(dpsChip.locator('.role-dot')).toHaveClass(/dps/);
  });

  test('Results show correct group composition', async ({ page }) => {
    await page.goto(`/?data=${encodeData(resultsData)}`);

    // Group 1 tank is Pandemonium
    const group1 = page.locator('#final-groups .group-card').first();
    await expect(group1.locator('.role-name').first()).toHaveText('Pandemonium');

    // Group 1 healer is Martz
    await expect(group1.locator('.role-name').nth(1)).toHaveText('Martz');
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
    await page.goto(`/?data=${encodeData(staticWheelsData)}`);
    const container = page.locator('.wheels-container');
    const display = await container.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('grid');
  });
});
