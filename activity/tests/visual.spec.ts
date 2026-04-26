import { test, expect } from '@playwright/test';
import { mockGuildData, mockChannelData, mockPlayers, mockGroups } from '../src/lib/mockData';
import { mockRaiderio } from './helpers/raiderio';

test.beforeEach(async ({ page }) => {
  await mockRaiderio(page);
});

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

const lobbySittingOutData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
  sittingOut: [mockPlayers[5].discordId, mockPlayers[7].discordId], // Mickey, Jonjee
  identity: lobbyIdentity,
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

    test('Lobby Sitting Out', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(lobbySittingOutData)}`);
      await expect(page.locator('#view-lobby')).toBeVisible();
      await expect(page.locator('.role-section-header--sitting-out')).toBeVisible();
      await expect(page.locator('.player-chip.sitting-out')).toHaveCount(2);
      await expect(page).toHaveScreenshot(`lobby-sitting-out-${viewport.width}x${viewport.height}.png`);
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

      // Side panel visible on desktop/tablet, hidden on mobile (<600px)
      if (viewport.width >= 600) {
        await expect(page.locator('#side-panel')).toBeVisible();
      }

      // Wait for canvas rendering to stabilize
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot(`wheels-static-${viewport.width}x${viewport.height}.png`);
    });

    test('Spinning Ready', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(spinningReadyData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const nextBtn = page.locator('#next-btn');
      await expect(nextBtn).toBeVisible();
      await expect(nextBtn).toBeEnabled();
      await expect(nextBtn).toHaveText('Spin');

      // Side panel visible on desktop/tablet, hidden on mobile (<600px)
      if (viewport.width >= 600) {
        await expect(page.locator('#side-panel')).toBeVisible();
      }

      await expect(page).toHaveScreenshot(`spinning-ready-${viewport.width}x${viewport.height}.png`);
    });

    test('Results', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(resultsData)}`);
      await expect(page.locator('#view-results')).toBeVisible();
      await expect(page.locator('#final-groups .group-card')).toHaveCount(mockGroups.length);

      const newRoundBtn = page.locator('#new-round-btn');
      await expect(newRoundBtn).toBeVisible();

      // Wait for the dungeon suggestions panel to reach a stable post-fetch
      // state so the screenshot doesn't race the loading skeleton.
      await expect(
        page.locator('.dungeon-suggestion-row:not(.dungeon-suggestion-row--skeleton)').first(),
      ).toBeVisible();

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

    test('Carousel navigation via dot click scrolls to wheel', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      // Navigate to healer (index 1) by clicking the dot
      await page.locator('.carousel-dot[data-index="1"]').click();
      await page.waitForTimeout(400);

      // The healer slot should now be in viewport
      await expect(page.locator('#slot-healer')).toBeInViewport();
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

    test('Side panel hidden on mobile, replaced by group pager', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      // Side column is not rendered on mobile (<600px)
      await expect(page.locator('.side-column')).not.toBeVisible();
    });
  });
});

// ── Functional Tests (viewport-independent) ──────────────────
test.describe('Functional Tests', () => {
  test('Lobby spin button starts enabled', async ({ page }) => {
    const data = {
      ...mockChannelData,
      status: 'lobby',
      players: mockPlayers,
      identity: lobbyIdentity,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    const spinBtn = page.locator('#spin-btn');
    await expect(spinBtn).toBeEnabled();
    await expect(spinBtn).toHaveText('SPIN THE WHEEL!');
  });

  test('Player chips show correct role colors', async ({ page }) => {
    await page.goto(`/?data=${encodeData(lobbyData)}`);

    // Role is conveyed via the chip's title attribute (portrait ring color is visual only)
    const tankChip = page.locator('.player-chip', { hasText: 'Gazzi' });
    await expect(tankChip).toHaveAttribute('title', 'Tank');

    const healerChip = page.locator('.player-chip', { hasText: 'Quill' });
    await expect(healerChip).toHaveAttribute('title', 'Healer');

    const dpsChip = page.locator('.player-chip', { hasText: 'Schmeebs' });
    await expect(dpsChip).toHaveAttribute('title', 'Ranged');
  });

  test('Results show correct group composition', async ({ page }) => {
    await page.goto(`/?data=${encodeData(resultsData)}`);

    // Group 1 tank is Gazzi (has brez ⚰️)
    const group1 = page.locator('#final-groups .group-card').first();
    await expect(group1.locator('.role-name').first()).toHaveText('Gazzi ⚰️');

    // Group 1 healer is Quill (has brez ⚰️)
    await expect(group1.locator('.role-name').nth(1)).toHaveText('Quill ⚰️');
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

// ── My Group Highlight Tests ─────────────────────────────────
// Fourseven (discordId 100000000000000007) is in Group 2
const resultsWithIdentityData = {
  ...resultsData,
  identity: { id: '100000000000000007', name: 'Fourseven' },
};

test.describe('My Group Highlight', () => {
  test.describe('Desktop (1280x720)', () => {
    test.use({ viewport: VIEWPORTS.desktop });

    test('Results with highlighted group', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(resultsWithIdentityData)}`);
      await expect(page.locator('#view-results')).toBeVisible();
      await expect(page.locator('.group-card.is-my-group')).toBeVisible();
      await expect(
        page.locator('.dungeon-suggestion-row:not(.dungeon-suggestion-row--skeleton)').first(),
      ).toBeVisible();
      await expect(page).toHaveScreenshot('results-my-group-1280x720.png');
    });
  });

  test.describe('Phone Portrait (420x700)', () => {
    test.use({ viewport: VIEWPORTS.phonePortrait });

    test('Results with highlighted group', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(resultsWithIdentityData)}`);
      await expect(page.locator('#view-results')).toBeVisible();
      await expect(page.locator('.group-card.is-my-group')).toBeVisible();
      await expect(
        page.locator('.dungeon-suggestion-row:not(.dungeon-suggestion-row--skeleton)').first(),
      ).toBeVisible();
      await expect(page).toHaveScreenshot('results-my-group-420x700.png');
    });
  });
});

// ── Grayscale Chosen Players Tests ───────────────────────────
// After group 1 is revealed, chosen players should appear grayscaled on the wheels
const grayscaleWheelsData = {
  ...mockChannelData,
  status: 'spinning',
  staticWheel: true,
  players: mockPlayers,
  groupCards: [
    {
      group: mockGroups[0], // Group 1: Gazzi (tank), Quill (healer), Schmeebs, Kitchenstink, Volkareth (dps)
      index: 0,
    },
  ],
};

test.describe('Grayscale Chosen Players', () => {
  test.describe('Desktop (1280x720)', () => {
    test.use({ viewport: VIEWPORTS.desktop });

    test('Wheels with chosen players grayscaled', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(grayscaleWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      // All 5 wheel canvases should be rendered
      await expect(page.locator('#wheel-tank')).toBeAttached();
      await expect(page.locator('#wheel-healer')).toBeAttached();
      await expect(page.locator('#wheel-dps1')).toBeAttached();

      // Group 1 should be shown in side panel
      await expect(page.locator('#groups-list .group-card')).toHaveCount(1);

      await expect(page).toHaveScreenshot('wheels-grayscale-1280x720.png');
    });
  });

  test.describe('Phone Portrait (420x700)', () => {
    test.use({ viewport: VIEWPORTS.phonePortrait });

    test('Wheels with chosen players grayscaled', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(grayscaleWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();
      await expect(page.locator('#wheel-tank')).toBeAttached();

      await expect(page).toHaveScreenshot('wheels-grayscale-420x700.png');
    });
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
