import type { Page } from '@playwright/test';

/**
 * A small per-character fixture that, summed across all mocked players, yields a
 * stable group ranking with FLOOD as the lowest-total dungeon.
 */
const FIXTURE_RUNS = [
  { id: 525, short: 'FLOOD', name: 'Operation: Floodgate', level: 8, score: 80 },
  { id: 542, short: 'EDA', name: "Eco-Dome Al'dani", level: 11, score: 145 },
  { id: 503, short: 'ARAK', name: 'Ara-Kara, City of Echoes', level: 12, score: 165 },
  { id: 505, short: 'DAWN', name: 'The Dawnbreaker', level: 12, score: 168 },
  { id: 499, short: 'PSF', name: 'Priory of the Sacred Flame', level: 13, score: 180 },
  { id: 378, short: 'HOA', name: 'Halls of Atonement', level: 13, score: 188 },
  { id: 391, short: 'STRT', name: 'Tazavesh: Streets of Wonder', level: 13, score: 192 },
  { id: 392, short: 'GMBT', name: "Tazavesh: So'leah's Gambit", level: 13, score: 196 },
];

// 1×1 grey PNG inlined as a data URL — keeps dungeon icons in test snapshots
// rendered as identical placeholder squares without depending on cdn.raiderio.net
// being reachable from the Docker test container.
const PLACEHOLDER_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkqAcAAIUAgUW0RjgAAAAASUVORK5CYII=';

function buildPayload(name: string) {
  return {
    name,
    realm: 'Test',
    mythic_plus_best_runs: FIXTURE_RUNS.map(f => ({
      dungeon: f.name,
      short_name: f.short,
      mythic_level: f.level,
      score: f.score,
      map_challenge_mode_id: f.id,
      icon_url: PLACEHOLDER_ICON,
      affixes: [],
    })),
    mythic_plus_alternate_runs: [],
  };
}

/**
 * Intercept Raider.io character profile requests and return a deterministic
 * fixture so visual snapshots stay stable.
 */
export async function mockRaiderio(page: Page) {
  await page.route('https://raider.io/api/v1/characters/profile**', async (route) => {
    const url = new URL(route.request().url());
    const name = url.searchParams.get('name') ?? 'Unknown';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildPayload(name)),
    });
  });
}
