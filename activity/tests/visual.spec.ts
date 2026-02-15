import { test, expect } from '@playwright/test';
import { mockSession, mockPlayers, mockGroups } from '../src/mockData';

// Helper to encode data for URL
const encodeData = (data: any) => Buffer.from(JSON.stringify(data)).toString('base64');

test.describe('Visual Regression Tests', () => {
  // ── 1. Channel Picker ──────────────────────────────────────
  test('Channel Picker View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'lobby',
      selectedChannelId: null,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    // Header elements
    await expect(page.locator('.app-header h1')).toHaveText('Mythic+ Wheel');
    await expect(page.locator('.guild-tag')).toHaveText('Gif or Gif');

    // Channel picker visible
    await expect(page.locator('#view-channels')).toBeVisible();
    await expect(page.locator('#view-channels h2')).toHaveText('Select a Voice Channel');

    // Should show channel cards matching mock data
    const channelCount = mockSession.voiceChannels?.length || 0;
    await expect(page.locator('.channel-card')).toHaveCount(channelCount);

    // Each card has name and user count
    for (let i = 0; i < channelCount; i++) {
      const card = page.locator('.channel-card').nth(i);
      await expect(card.locator('.channel-name')).toBeVisible();
      await expect(card.locator('.channel-count')).toBeVisible();
    }

    // Other views hidden
    await expect(page.locator('#view-lobby')).toBeHidden();
    await expect(page.locator('#view-wheels')).toBeHidden();
    await expect(page.locator('#view-results')).toBeHidden();

    await expect(page).toHaveScreenshot('channel-picker.png');
  });

  // ── 2. Lobby with Players ──────────────────────────────────
  test('Lobby View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'lobby',
      selectedChannelId: 'vc-1',
      players: mockPlayers,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    await expect(page.locator('#view-lobby')).toBeVisible();

    // Player count badge
    await expect(page.locator('#player-count')).toHaveText(`${mockPlayers.length} players`);

    // Player chips with role dots
    await expect(page.locator('.player-chip')).toHaveCount(mockPlayers.length);
    await expect(page.locator('.player-chip .role-dot')).toHaveCount(mockPlayers.length);

    // Spin button enabled with correct text
    const spinBtn = page.locator('#spin-btn');
    await expect(spinBtn).toBeVisible();
    await expect(spinBtn).toBeEnabled();
    await expect(spinBtn).toHaveText('SPIN THE WHEEL!');

    await expect(page).toHaveScreenshot('lobby.png');
  });

  // ── 3. Lobby - Empty (waiting for players) ─────────────────
  test('Lobby Empty View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'lobby',
      selectedChannelId: 'vc-1',
      players: [],
    };
    await page.goto(`/?data=${encodeData(data)}`);

    await expect(page.locator('#view-lobby')).toBeVisible();

    // No player chips
    await expect(page.locator('.player-chip')).toHaveCount(0);

    // Spin button disabled
    const spinBtn = page.locator('#spin-btn');
    await expect(spinBtn).toBeDisabled();
    await expect(spinBtn).toHaveText('Waiting for players...');

    await expect(page).toHaveScreenshot('lobby-empty.png');
  });

  // ── 4. Static Wheels (all 5 canvases) ──────────────────────
  test('Static Wheel View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'spinning',
      staticWheel: true,
      selectedChannelId: 'vc-1',
      players: mockPlayers,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    await expect(page.locator('#view-wheels')).toBeVisible();

    // All 5 wheel canvases visible
    await expect(page.locator('#wheel-tank')).toBeVisible();
    await expect(page.locator('#wheel-healer')).toBeVisible();
    await expect(page.locator('#wheel-dps1')).toBeVisible();
    await expect(page.locator('#wheel-dps2')).toBeVisible();
    await expect(page.locator('#wheel-dps3')).toBeVisible();

    // Role labels
    await expect(page.locator('.label-tank')).toHaveText('Tank');
    await expect(page.locator('.label-healer')).toHaveText('Healer');
    await expect(page.locator('.label-dps')).toHaveCount(3);

    // Side panel visible (staticWheel shows it)
    await expect(page.locator('#side-panel')).toBeVisible();

    // Status text
    await expect(page.locator('#wheel-status')).toHaveText('Static preview');

    // Spin button hidden in static mode
    await expect(page.locator('#next-btn')).toBeHidden();

    await expect(page).toHaveScreenshot('wheels.png');
  });

  // ── 5. Spinning Ready State (pre-spin with button) ─────────
  test('Spinning Ready State', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'spinning',
      selectedChannelId: 'vc-1',
      players: mockPlayers,
      groups: mockGroups,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    await expect(page.locator('#view-wheels')).toBeVisible();

    // "Spin for Group 1" button visible and enabled
    const nextBtn = page.locator('#next-btn');
    await expect(nextBtn).toBeVisible();
    await expect(nextBtn).toBeEnabled();
    await expect(nextBtn).toHaveText('Spin for Group 1');

    // Side panel visible but empty (no groups formed yet)
    await expect(page.locator('#side-panel')).toBeVisible();
    await expect(page.locator('#groups-list .group-card')).toHaveCount(0);

    // All 5 canvases rendered
    await expect(page.locator('#wheel-tank')).toBeVisible();
    await expect(page.locator('#wheel-dps3')).toBeVisible();

    await expect(page).toHaveScreenshot('spinning-ready.png');
  });

  // ── 6. Results ─────────────────────────────────────────────
  test('Results View', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'completed',
      selectedChannelId: 'vc-1',
      players: mockPlayers,
      groups: mockGroups,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    await expect(page.locator('#view-results')).toBeVisible();
    await expect(page.locator('#view-results h2')).toHaveText('All Groups Formed!');

    // Group cards matching mock data
    await expect(page.locator('#final-groups .group-card')).toHaveCount(mockGroups.length);

    // Each group card has role entries
    for (let i = 0; i < mockGroups.length; i++) {
      const card = page.locator('#final-groups .group-card').nth(i);
      await expect(card.locator('h4')).toHaveText(`Group ${i + 1}`);
      // Tank + Healer + 3 DPS = 5 role lines
      await expect(card.locator('.group-role')).toHaveCount(5);
    }

    // New Round button
    const newRoundBtn = page.locator('#new-round-btn');
    await expect(newRoundBtn).toBeVisible();
    await expect(newRoundBtn).toHaveText('New Round');

    // Wheels and lobby hidden
    await expect(page.locator('#view-wheels')).toBeHidden();
    await expect(page.locator('#view-lobby')).toBeHidden();

    await expect(page).toHaveScreenshot('results.png');
  });

  // ── 7. No Session (demo controls shown) ────────────────────
  test('No Session View', async ({ page }) => {
    // Navigate without any data or guildId
    await page.goto('/');

    // Status message shown
    await expect(page.locator('#status-message')).toHaveText(
      'No Guild/Session ID found. Try the Demo below.'
    );

    // Demo button visible
    await expect(page.locator('#demo-controls')).toBeVisible();
    await expect(page.locator('#start-demo-btn')).toBeVisible();
    await expect(page.locator('#start-demo-btn')).toHaveText('Start Demo');

    // No views shown
    await expect(page.locator('#view-channels')).toBeHidden();
    await expect(page.locator('#view-lobby')).toBeHidden();
    await expect(page.locator('#view-wheels')).toBeHidden();
    await expect(page.locator('#view-results')).toBeHidden();

    await expect(page).toHaveScreenshot('no-session.png');
  });
});

test.describe('Responsive Tests', () => {
  test.use({ viewport: { width: 600, height: 800 } });

  // ── Lobby at small viewport ────────────────────────────────
  test('Lobby View - Small Viewport', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'lobby',
      selectedChannelId: 'vc-1',
      players: mockPlayers,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    await expect(page.locator('#view-lobby')).toBeVisible();
    await expect(page.locator('.player-chip')).toHaveCount(mockPlayers.length);
    await expect(page.locator('#spin-btn')).toBeEnabled();

    await expect(page).toHaveScreenshot('lobby-small.png');
  });

  // ── Wheels at small viewport ───────────────────────────────
  test('Static Wheels - Small Viewport', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'spinning',
      staticWheel: true,
      selectedChannelId: 'vc-1',
      players: mockPlayers,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    await expect(page.locator('#view-wheels')).toBeVisible();
    // All 5 canvases still visible (they wrap/resize)
    await expect(page.locator('#wheel-tank')).toBeVisible();
    await expect(page.locator('#wheel-healer')).toBeVisible();
    await expect(page.locator('#wheel-dps1')).toBeVisible();
    await expect(page.locator('#wheel-dps2')).toBeVisible();
    await expect(page.locator('#wheel-dps3')).toBeVisible();

    await expect(page).toHaveScreenshot('wheels-small.png');
  });

  // ── Results at small viewport ──────────────────────────────
  test('Results View - Small Viewport', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'completed',
      selectedChannelId: 'vc-1',
      players: mockPlayers,
      groups: mockGroups,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    await expect(page.locator('#view-results')).toBeVisible();
    await expect(page.locator('#final-groups .group-card')).toHaveCount(mockGroups.length);

    await expect(page).toHaveScreenshot('results-small.png');
  });
});

test.describe('Functional Tests', () => {
  // ── Channel selection navigates to lobby ────────────────────
  test('Channel selection shows lobby', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'lobby',
      selectedChannelId: null,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    await expect(page.locator('#view-channels')).toBeVisible();

    // Click first channel
    await page.locator('.channel-card').first().click();

    // Should transition to lobby view
    await expect(page.locator('#view-lobby')).toBeVisible();
    await expect(page.locator('#view-channels')).toBeHidden();

    // Players should be loaded (mock data injects mockPlayers on channel select)
    await expect(page.locator('.player-chip')).toHaveCount(mockPlayers.length);
  });

  // ── Calculating state disables spin button ──────────────────
  test('Request spin shows calculating state', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'request_spin',
      selectedChannelId: 'vc-1',
      players: mockPlayers,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    // Spin button disabled with "Calculating..." text
    const spinBtn = page.locator('#spin-btn');
    await expect(spinBtn).toBeDisabled();
    await expect(spinBtn).toHaveText('Calculating...');
  });

  // ── Role dots have correct classes ──────────────────────────
  test('Player chips show correct role colors', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'lobby',
      selectedChannelId: 'vc-1',
      players: mockPlayers,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    // Pandemonium is a tank main (index 4 in mockPlayers)
    const tankChip = page.locator('.player-chip', { hasText: 'Pandemonium' });
    await expect(tankChip.locator('.role-dot')).toHaveClass(/tank/);

    // Martz is a healer main (index 0)
    const healerChip = page.locator('.player-chip', { hasText: 'Martz' });
    await expect(healerChip.locator('.role-dot')).toHaveClass(/healer/);

    // KingofSkillz is DPS main (index 1)
    const dpsChip = page.locator('.player-chip', { hasText: 'KingofSkillz' });
    await expect(dpsChip.locator('.role-dot')).toHaveClass(/dps/);
  });

  // ── Results display correct group members ───────────────────
  test('Results show correct group composition', async ({ page }) => {
    const data = {
      ...mockSession,
      status: 'completed',
      selectedChannelId: 'vc-1',
      players: mockPlayers,
      groups: mockGroups,
    };
    await page.goto(`/?data=${encodeData(data)}`);

    // Group 1 tank is Pandemonium
    const group1 = page.locator('#final-groups .group-card').first();
    await expect(group1.locator('.role-name').first()).toHaveText('Pandemonium');

    // Group 1 healer is Martz
    await expect(group1.locator('.role-name').nth(1)).toHaveText('Martz');
  });
});
