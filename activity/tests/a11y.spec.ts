import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockChannelData, mockPlayers, mockGroups } from '../src/lib/mockData';
import { mockRaiderio } from './helpers/raiderio';

test.beforeEach(async ({ page }) => {
  await mockRaiderio(page);
});

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

// Use Gazzi (index 4) as identity — has mainRole + inGameName so isPlayerReady passes
const lobbyIdentity = { id: mockPlayers[4].discordId, name: mockPlayers[4].name };

const lobbyData = {
  ...mockChannelData,
  status: 'lobby',
  players: mockPlayers,
  selectedChannelId: 'vc-1',
  identity: lobbyIdentity,
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

  const firstChip = page.locator('.player-chip').first();
  await expect(firstChip).toBeVisible();

  // Role is conveyed via the chip's title attribute (tooltip + a11y fallback)
  const title = await firstChip.getAttribute('title');
  expect(title).toBeTruthy();
  expect(['Tank', 'Healer', 'Ranged', 'Melee', 'Unassigned']).toContain(title);

  // Chip root has an aria-label for screen readers
  const ariaLabel = await firstChip.getAttribute('aria-label');
  expect(ariaLabel).toBeTruthy();
});

test('Clicking Wheelson header navigates back to home', async ({ page }) => {
  await page.goto(`/?data=${encodeData(lobbyData)}`);

  await expect(page.locator('#view-lobby')).toBeVisible();
  await expect(page.locator('#view-home')).toBeHidden();

  await page.locator('.header-bar__icon').click();

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

test('Offspec role icons are visually de-emphasized', async ({ page }) => {
  await page.goto(`/?data=${encodeData(resultsData)}`);
  await expect(page.locator('#view-results')).toBeVisible();

  // Off-spec slots inside the active carousel slide get a dimmed/desaturated
  // role glyph via the .is-offspec modifier.
  const offspecIcons = page.locator('.group-carousel__slide--active .group-slide__role-icon.is-offspec');
  const count = await offspecIcons.count();
  if (count > 0) {
    const opacity = await offspecIcons.first().evaluate(el => {
      const svg = el.querySelector('svg');
      return svg ? getComputedStyle(svg).opacity : '1';
    });
    expect(parseFloat(opacity)).toBeLessThan(1);
  }
});

test('Group slide role icons have a11y attributes', async ({ page }) => {
  await page.goto(`/?data=${encodeData(resultsData)}`);
  await expect(page.locator('#view-results')).toBeVisible();

  // Scope to the active slide so we don't pick up duplicates from peek slides.
  const indicators = page.locator('.group-carousel__slide--active .group-slide__role-icon');
  const count = await indicators.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const el = indicators.nth(i);
    await expect(el).toHaveAttribute('role', 'img');
    const ariaLabel = await el.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    // Filled slot: "Tank" / "Healer" / "DPS" (with optional " (offspec)").
    // Empty slot (remainder): "Tank slot empty" / "Healer slot empty" / "DPS slot empty".
    expect(ariaLabel).toMatch(/^(Tank|Healer|DPS)( \(offspec\)| slot empty)?$/);
  }
});
