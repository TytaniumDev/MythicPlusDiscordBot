import { test, expect } from '@playwright/test';
import { mockSession, mockPlayers, mockGroups } from '../src/mockData';

// Helper to encode data for URL
const encodeData = (data: any) => Buffer.from(JSON.stringify(data)).toString('base64');

test.describe('Accessibility Verification', () => {
  test('Wheels and Results should have ARIA attributes', async ({ page }) => {
    // Setup: Spinning state (wheels visible)
    const data = {
      ...mockSession,
      status: 'spinning',
      staticWheel: true, // Use static mode so wheels are rendered immediately
      selectedChannelId: 'vc-1',
      players: mockPlayers,
    };

    // Load page with mock data
    await page.goto(`/?data=${encodeData(data)}`);

    // Verify view is visible
    await expect(page.locator('#view-wheels')).toBeVisible();

    // 1. Check Canvases for role="img" and aria-label
    const wheels = [
      { id: '#wheel-tank', role: 'Tank' },
      { id: '#wheel-healer', role: 'Healer' },
      { id: '#wheel-dps1', role: 'DPS' },
      { id: '#wheel-dps2', role: 'DPS' },
      { id: '#wheel-dps3', role: 'DPS' },
    ];

    for (const wheel of wheels) {
      const locator = page.locator(wheel.id);
      await expect(locator).toBeVisible();

      // These assertions are expected to FAIL initially
      await expect(locator).toHaveAttribute('role', 'img');
      // The aria-label should be descriptive, e.g. "Wheel with N candidates"
      // We expect it to at least contain "wheel" (case-insensitive)
      await expect(locator).toHaveAttribute('aria-label', /[Ww]heel/);
    }

    // 2. Check Result Containers for aria-live="polite"
    const results = [
      '#result-tank',
      '#result-healer',
      '#result-dps1',
      '#result-dps2',
      '#result-dps3',
    ];

    for (const resultId of results) {
      const locator = page.locator(resultId);
      // These are empty divs initially, but should have the attribute
      await expect(locator).toHaveAttribute('aria-live', 'polite');
    }

    // 3. Check Status Message for role="status" and aria-live="polite"
    const statusMsg = page.locator('#status-message');
    await expect(statusMsg).toHaveAttribute('role', 'status');
    await expect(statusMsg).toHaveAttribute('aria-live', 'polite');

    // Take screenshot for verification
    await page.screenshot({ path: 'tests/accessibility-check.png' });
  });
});
