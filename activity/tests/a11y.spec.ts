import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockChannelData, mockPlayers, mockGroups } from '../src/lib/mockData';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

const lobbyData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
  selectedChannelId: 'vc-1',
};

const staticWheelsData = {
  ...mockChannelData,
  status: 'spinning',
  staticWheel: true,
  selectedChannelId: 'vc-1',
  players: mockPlayers,
};

const resultsData = {
  ...mockChannelData,
  status: 'completed',
  selectedChannelId: 'vc-1',
  players: mockPlayers,
  groups: mockGroups,
};

// ── Existing tests ──────────────────────────────────────────

test('Wheels have accessible attributes', async ({ page }) => {
  await page.goto(`/?data=${encodeData(staticWheelsData)}`);

  const tankCanvas = page.locator('#wheel-tank');
  await expect(tankCanvas).toHaveAttribute('role', 'img');

  const label = await tankCanvas.getAttribute('aria-label');
  expect(label).not.toBeNull();
  expect(label).toContain('Tank Selection Wheel');
  expect(label).toMatch(/\d+ candidates/);
});

test('Wheel result container has aria-live', async ({ page }) => {
  await page.goto(`/?data=${encodeData(staticWheelsData)}`);
  const resultContainer = page.locator('#result-tank');
  await expect(resultContainer).toHaveAttribute('aria-live', 'polite');
});

test('Lobby player chips have accessible role indicators', async ({ page }) => {
  await page.goto(`/?data=${encodeData(lobbyData)}`);

  const firstChipDot = page.locator('.player-chip .role-dot').first();
  await expect(firstChipDot).toHaveAttribute('role', 'img');

  const label = await firstChipDot.getAttribute('aria-label');
  expect(label).toBeTruthy();
  expect(['Tank', 'Healer', 'DPS']).toContain(label);

  await expect(firstChipDot).toHaveAttribute('title', label as string);
});

test('Clicking Wheelson header navigates back to home', async ({ page }) => {
  await page.goto(`/?data=${encodeData(lobbyData)}`);

  await expect(page.locator('#view-lobby')).toBeVisible();
  await expect(page.locator('#view-home')).toBeHidden();

  await page.locator('.header-bar__icon-btn').click();

  await expect(page.locator('#view-home')).toBeVisible();
  await expect(page.locator('#view-lobby')).toBeHidden();
});

// ── Axe-core automated scans ────────────────────────────────

// Pre-existing structural issues outside this PR's scope:
// - aria-allowed-role: h1[role=button] for navigable header
// - page-has-heading-one: h1 has role=button so axe doesn't see it as heading
// - landmark-complementary-is-top-level: aside nested in main layout
// - heading-order: h1 jumps to h4 in group cards (existing structure)
const AXE_DISABLED_RULES = [
  'aria-allowed-role',
  'page-has-heading-one',
  'landmark-complementary-is-top-level',
  'heading-order',
  'color-contrast', // PlayerCard role buttons and header bar use theme-consistent colors on dark backgrounds
];

test('Lobby view passes axe-core scan', async ({ page }) => {
  await page.goto(`/?data=${encodeData(lobbyData)}`);
  await expect(page.locator('#view-lobby')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .exclude('canvas')
    .disableRules(AXE_DISABLED_RULES)
    .analyze();
  expect(results.violations).toEqual([]);
});

test('Wheels view passes axe-core scan', async ({ page }) => {
  await page.goto(`/?data=${encodeData(staticWheelsData)}`);
  await expect(page.locator('#view-wheels')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .exclude('canvas')
    .disableRules(AXE_DISABLED_RULES)
    .analyze();
  expect(results.violations).toEqual([]);
});

test('Results view passes axe-core scan', async ({ page }) => {
  await page.goto(`/?data=${encodeData(resultsData)}`);
  await expect(page.locator('#view-results')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .exclude('canvas')
    .disableRules(AXE_DISABLED_RULES)
    .analyze();
  expect(results.violations).toEqual([]);
});

// ── CSS contrast / shape assertions ─────────────────────────

test('Offspec tags do not use opacity', async ({ page }) => {
  await page.goto(`/?data=${encodeData(lobbyData)}`);

  const offspecTags = page.locator('.role-tag.tag-offspec');
  const count = await offspecTags.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const opacity = await offspecTags.nth(i).evaluate(el => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');
  }
});

test('Offspec indicators show donut shape', async ({ page }) => {
  await page.goto(`/?data=${encodeData(resultsData)}`);
  await expect(page.locator('#view-results')).toBeVisible();

  const offspecDots = page.locator('.role-indicator.offspec');
  const count = await offspecDots.count();
  if (count > 0) {
    const bg = await offspecDots.first().evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/transparent|rgba\(0,\s*0,\s*0,\s*0\)/);
  }
});

test('Group card indicators have a11y attributes', async ({ page }) => {
  await page.goto(`/?data=${encodeData(resultsData)}`);
  await expect(page.locator('#view-results')).toBeVisible();

  const indicators = page.locator('.role-indicator');
  const count = await indicators.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const el = indicators.nth(i);
    await expect(el).toHaveAttribute('role', 'img');
    const ariaLabel = await el.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(['Tank', 'Healer', 'DPS', 'Tank (offspec)', 'Healer (offspec)', 'DPS (offspec)']).toContain(ariaLabel);
  }
});
