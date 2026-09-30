import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

// Native sizes of Blizzard's character-render variants.
const VARIANT_SIZES: Record<string, { width: number; height: number; background: boolean }> = {
  'avatar.jpg': { width: 84, height: 84, background: true },
  'inset.jpg': { width: 230, height: 116, background: true },
  'main-raw.png': { width: 1600, height: 1200, background: false },
};

/**
 * Saved copies of the mock players' real renders (src/lib/mockData.ts), named
 * `<renderId>-<variant>`. main-raw.png is kept at half size (800x600): the
 * same framing as Blizzard's 1600x1200 canvas, so CSS crops land the same.
 * Save both variants here when adding a mock player.
 */
const SAVED_RENDERS_DIR = join(__dirname, '..', 'character-renders');
const SAVED_CONTENT_TYPES: Record<string, string> = {
  'avatar.jpg': 'image/jpeg',
  'main-raw.png': 'image/png',
};

function savedRender(renderId: string, variant: string): Buffer | null {
  if (!SAVED_CONTENT_TYPES[variant]) return null;
  const file = join(SAVED_RENDERS_DIR, `${renderId}-${variant}`);
  return existsSync(file) ? readFileSync(file) : null;
}

function hueFor(text: string): number {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

/**
 * A deterministic stand-in for a render with no saved copy: a silhouette whose
 * colour is derived from the character's render id, so players stay
 * distinguishable in screenshots.
 */
function placeholderSvg(renderId: string, variant: string): string {
  const { width, height, background } = VARIANT_SIZES[variant] ?? VARIANT_SIZES['avatar.jpg'];
  const hue = hueFor(renderId);
  const cx = width / 2;
  const unit = Math.min(width, height);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    background ? `<rect width="100%" height="100%" fill="hsl(${hue}, 30%, 25%)"/>` : '',
    `<circle cx="${cx}" cy="${height * 0.35}" r="${unit * 0.18}" fill="hsl(${hue}, 60%, 60%)"/>`,
    `<ellipse cx="${cx}" cy="${height * 0.95}" rx="${unit * 0.34}" ry="${unit * 0.4}" fill="hsl(${hue}, 60%, 45%)"/>`,
    '</svg>',
  ].join('');
}

/**
 * Serve Blizzard character renders locally: the saved copy when there is one,
 * otherwise a placeholder. Live renders change whenever a player logs out,
 * which made screenshots drift, and the Docker test container can't always
 * reach Blizzard's CDN.
 */
export async function mockCharacterRenders(page: Page) {
  await page.route('https://render.worldofwarcraft.com/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const match = /\/(\d+)-(avatar\.jpg|inset\.jpg|main-raw\.png)$/.exec(pathname);
    if (!match) {
      await route.fulfill({ status: 404 });
      return;
    }
    const [, renderId, variant] = match;
    const saved = savedRender(renderId, variant);
    await route.fulfill(saved
      ? { status: 200, contentType: SAVED_CONTENT_TYPES[variant], body: saved }
      : { status: 200, contentType: 'image/svg+xml', body: placeholderSvg(renderId, variant) });
  });
}
