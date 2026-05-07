import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCurrentSeasonInfo } from '../src/fetchCurrentSeason.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchCurrentSeasonInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns slug, blizzardSeasonId, expansionId from raider.io', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        seasons: [
          {
            slug: 'season-mn-1',
            blizzard_season_id: 17,
            is_main_season: true,
          },
        ],
      }),
    });

    const result = await fetchCurrentSeasonInfo();

    expect(result).toEqual({
      slug: 'season-mn-1',
      blizzardSeasonId: 17,
      expansionId: 11,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://raider.io/api/v1/mythic-plus/static-data?expansion_id=11',
    );
  });

  it('throws when the request fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(fetchCurrentSeasonInfo()).rejects.toThrow(/Raider\.IO.*503/);
  });

  it('throws when the response has empty seasons array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ seasons: [] }),
    });
    await expect(fetchCurrentSeasonInfo()).rejects.toThrow(/expansion_id needs to be bumped/);
  });

  it('throws when the response is missing seasons', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    await expect(fetchCurrentSeasonInfo()).rejects.toThrow(/seasons/);
  });

  it('selects the entry with is_main_season=true, ignoring cutoffs/event variants ahead of it', async () => {
    // Mirror the real expansion_id=10 response shape: cutoffs + variant
    // entries appear before the live main season at index 0.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        seasons: [
          { slug: 'season-mn-1-cutoffs', blizzard_season_id: 17, is_main_season: false },
          { slug: 'season-mn-1', blizzard_season_id: 17, is_main_season: true },
          { slug: 'season-mn-1-break-the-meta', blizzard_season_id: 17, is_main_season: false },
        ],
      }),
    });

    const result = await fetchCurrentSeasonInfo();
    expect(result.slug).toBe('season-mn-1');
  });

  it('throws when no entry has is_main_season=true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        seasons: [
          { slug: 'season-mn-0-preseason', blizzard_season_id: 16, is_main_season: false },
        ],
      }),
    });
    await expect(fetchCurrentSeasonInfo()).rejects.toThrow(/no main season|expansion_id needs to be bumped/);
  });
});
