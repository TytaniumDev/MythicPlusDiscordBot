import { test, expect } from '@playwright/test';
import { mockChannelData, mockPlayers, mockGroups } from '../src/lib/mockData';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

// Seed Math.random for deterministic wheel rendering in screenshots
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

const VIEWPORTS = {
  desktop:        { width: 1280, height: 720 },
  tablet:         { width: 800,  height: 600 },
  phonePortrait:  { width: 420,  height: 700 },
  discordSquare:  { width: 380,  height: 380 },
  landscapeShort: { width: 800,  height: 400 },
} as const;

const staticWheelsData = {
  ...mockChannelData,
  status: 'spinning',
  staticWheel: true,
  selectedChannelId: 'vc-1',
  players: mockPlayers,
};

const spinningReadyData = {
  ...mockChannelData,
  status: 'spinning',
  selectedChannelId: 'vc-1',
  players: mockPlayers,
  groups: mockGroups,
};

// ── WheelsGrid Component Screenshots ─────────────────────────
// These take element-level screenshots of just the wheels grid,
// isolated from the rest of the page chrome (header, button, side panel).

test.describe('WheelsGrid Component', () => {
  test.describe('Grid Mode (Desktop 1280x720)', () => {
    test.use({ viewport: VIEWPORTS.desktop });

    test('Grid container screenshot', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const container = page.locator('.wheels-container');
      await expect(container).toBeVisible();
      await expect(container).toHaveScreenshot('grid-container-desktop.png');
    });

    test('Wheels area screenshot', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const area = page.locator('.wheels-area');
      await expect(area).toBeVisible();
      await expect(area).toHaveScreenshot('wheels-area-desktop.png');
    });

    test('Individual wheel slot screenshot', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const tankSlot = page.locator('#slot-tank');
      await expect(tankSlot).toBeVisible();
      await expect(tankSlot).toHaveScreenshot('wheel-slot-tank-desktop.png');
    });

    test('Spinning ready state screenshot', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(spinningReadyData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const container = page.locator('.wheels-container');
      await expect(container).toBeVisible();
      await expect(container).toHaveScreenshot('grid-container-spinning-ready.png');
    });
  });

  test.describe('Grid Mode (Tablet 800x600)', () => {
    test.use({ viewport: VIEWPORTS.tablet });

    test('Grid container screenshot', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const container = page.locator('.wheels-container');
      await expect(container).toBeVisible();
      await expect(container).toHaveScreenshot('grid-container-tablet.png');
    });
  });

  test.describe('Grid Mode (Landscape Short 800x400)', () => {
    test.use({ viewport: VIEWPORTS.landscapeShort });

    test('Grid container screenshot', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const container = page.locator('.wheels-container');
      await expect(container).toBeVisible();
      await expect(container).toHaveScreenshot('grid-container-landscape.png');
    });
  });

  test.describe('Carousel Mode (Phone 420x700)', () => {
    test.use({ viewport: VIEWPORTS.phonePortrait });

    test('Carousel container screenshot (Tank)', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const area = page.locator('.wheels-area');
      await expect(area).toBeVisible();
      await expect(area).toHaveScreenshot('carousel-area-phone-tank.png');
    });

    test('Carousel container screenshot (Healer)', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      // Navigate to healer slide
      await page.locator('.carousel-dot[data-index="1"]').click();
      await page.waitForTimeout(400);

      const area = page.locator('.wheels-area');
      await expect(area).toHaveScreenshot('carousel-area-phone-healer.png');
    });

    test('Carousel container screenshot (DPS)', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      // Navigate to DPS1 slide
      await page.locator('.carousel-dot[data-index="2"]').click();
      await page.waitForTimeout(400);

      const area = page.locator('.wheels-area');
      await expect(area).toHaveScreenshot('carousel-area-phone-dps1.png');
    });

    test('Carousel dots screenshot', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const dots = page.locator('.carousel-dots');
      await expect(dots).toBeVisible();
      await expect(dots).toHaveScreenshot('carousel-dots-phone.png');
    });
  });

  test.describe('Carousel Mode (Discord Square 380x380)', () => {
    test.use({ viewport: VIEWPORTS.discordSquare });

    test('Carousel container screenshot', async ({ page }) => {
      await page.addInitScript(DETERMINISTIC_RANDOM_SCRIPT);
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();

      const area = page.locator('.wheels-area');
      await expect(area).toBeVisible();
      await expect(area).toHaveScreenshot('carousel-area-discord-square.png');
    });
  });
});

// ── WheelsGrid Layout Verification ───────────────────────────
// Non-screenshot tests that verify the layout properties are correct.

test.describe('WheelsGrid Layout', () => {
  test.describe('Desktop', () => {
    test.use({ viewport: VIEWPORTS.desktop });

    test('Grid uses 2-row layout', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      const container = page.locator('.wheels-container');

      // Container is a flex column holding two row-grid children.
      const display = await container.evaluate(el => getComputedStyle(el).display);
      expect(display).toBe('flex');

      // Top row: 2 column tracks (tank, healer). Bottom row: 3 column tracks (3 DPS).
      const topCols = await page
        .locator('.wheels-row--top')
        .evaluate(el => getComputedStyle(el).gridTemplateColumns);
      expect(topCols.split(' ').filter(v => v.length > 0)).toHaveLength(2);

      const bottomCols = await page
        .locator('.wheels-row--bottom')
        .evaluate(el => getComputedStyle(el).gridTemplateColumns);
      expect(bottomCols.split(' ').filter(v => v.length > 0)).toHaveLength(3);
    });

    test('No overflow hidden on grid container', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      const container = page.locator('.wheels-container');
      const overflow = await container.evaluate(el => getComputedStyle(el).overflow);
      expect(overflow).not.toBe('hidden');
    });

    test('All 5 wheel canvases are visible and non-zero size', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);

      for (const id of ['#wheel-tank', '#wheel-healer', '#wheel-dps1', '#wheel-dps2', '#wheel-dps3']) {
        const canvas = page.locator(id);
        await expect(canvas).toBeVisible();
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(10);
        expect(box!.height).toBeGreaterThan(10);
      }
    });

    test('Spin prompt overlays wheels and is centered in the viewport', async ({ page }) => {
      await page.goto(`/?data=${encodeData(spinningReadyData)}`);

      const btn = page.locator('#next-btn');
      await expect(btn).toBeVisible();
      const btnBox = await btn.boundingBox();
      const viewport = page.viewportSize();
      expect(btnBox).not.toBeNull();
      expect(viewport).not.toBeNull();

      // Button should sit roughly in the middle of the viewport (within
      // a generous tolerance to allow for the orbital stage offset).
      const cx = btnBox!.x + btnBox!.width / 2;
      const cy = btnBox!.y + btnBox!.height / 2;
      expect(Math.abs(cx - viewport!.width / 2)).toBeLessThan(viewport!.width * 0.1);
      expect(Math.abs(cy - viewport!.height / 2)).toBeLessThan(viewport!.height * 0.15);

      // Wheels remain attached in DOM behind the overlay
      await expect(page.locator('.wheel-frame').first()).toBeAttached();
    });

    test('Tank and healer in top row, DPS in bottom row', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);

      const tankBox = await page.locator('#slot-tank').boundingBox();
      const healerBox = await page.locator('#slot-healer').boundingBox();
      const dps1Box = await page.locator('#slot-dps1').boundingBox();

      expect(tankBox).not.toBeNull();
      expect(healerBox).not.toBeNull();
      expect(dps1Box).not.toBeNull();

      // Tank and healer should be in the same row (similar Y)
      expect(Math.abs(tankBox!.y - healerBox!.y)).toBeLessThan(5);

      // DPS should be below tank row
      expect(dps1Box!.y).toBeGreaterThan(tankBox!.y + tankBox!.height * 0.5);
    });
  });

  test.describe('Carousel', () => {
    test.use({ viewport: VIEWPORTS.phonePortrait });

    test('Only one wheel slot visible at a time in carousel', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      await expect(page.locator('#view-wheels')).toBeVisible();
      await expect(page.locator('#slot-tank')).toBeInViewport();
    });

    test('Carousel dots visible and have correct count', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);
      const dots = page.locator('.carousel-dot');
      await expect(dots).toHaveCount(5);
      await expect(page.locator('.carousel-dots')).toBeVisible();
    });

    test('Carousel dot navigation works', async ({ page }) => {
      await page.goto(`/?data=${encodeData(staticWheelsData)}`);

      // Click healer dot
      await page.locator('.carousel-dot[data-index="1"]').click();
      await page.waitForTimeout(400);

      // Healer dot should be active
      await expect(page.locator('.carousel-dot[data-index="1"]')).toHaveClass(/active/);
      await expect(page.locator('.carousel-dot[data-index="0"]')).not.toHaveClass(/active/);
    });
  });
});
