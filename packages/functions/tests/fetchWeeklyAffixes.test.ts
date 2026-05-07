import { describe, it, expect, vi } from 'vitest';
import { buildAffixDocument } from '../src/fetchWeeklyAffixes';
import { writeSeasonConfig } from '../src/fetchWeeklyAffixes.js';

describe('buildAffixDocument', () => {
  it('resolves affix IDs to display data and sorts by keystone level', () => {
    const result = buildAffixDocument([160, 10, 147], 'us');

    expect(result.region).toBe('us');
    // Lindormi's (165) is injected automatically, so 4 total
    expect(result.affixes).toHaveLength(4);
    // Sorted: Lindormi's (0) → Devour (1) → Fortified (2) → Guile (4)
    expect(result.affixes[0].id).toBe(165);
    expect(result.affixes[1].id).toBe(160);
    expect(result.affixes[2].id).toBe(10);
    expect(result.affixes[3].id).toBe(147);

    const devour = result.affixes.find(a => a.id === 160);
    expect(devour).toMatchObject({
      nickname: 'Dispel Allies',
      keystoneLevel: '+4–11',
      color: '#a855f7',
    });
  });

  it('skips unknown affix IDs', () => {
    const result = buildAffixDocument([99999, 10], 'us');
    // Fortified + injected Lindormi's = 2
    expect(result.affixes).toHaveLength(2);
    expect(result.affixes[0].id).toBe(165);
    expect(result.affixes[1].id).toBe(10);
  });

  it('injects Lindormi\'s Guidance when not in input', () => {
    const result = buildAffixDocument([162, 10, 9, 147], 'us');
    expect(result.affixes.some(a => a.id === 165)).toBe(true);
    expect(result.affixes).toHaveLength(5);
  });

  it('does not duplicate Lindormi\'s Guidance if already present', () => {
    const result = buildAffixDocument([165, 162, 10, 147], 'us');
    const lindormisCount = result.affixes.filter(a => a.id === 165).length;
    expect(lindormisCount).toBe(1);
  });

  it('handles both Fortified and Tyrannical', () => {
    const result = buildAffixDocument([162, 10, 9, 147], 'us');
    expect(result.affixes.some(a => a.id === 10)).toBe(true);
    expect(result.affixes.some(a => a.id === 9)).toBe(true);
    // Fort (order 2) before Tyran (order 3)
    const fortIdx = result.affixes.findIndex(a => a.id === 10);
    const tyranIdx = result.affixes.findIndex(a => a.id === 9);
    expect(fortIdx).toBeLessThan(tyranIdx);
  });
});

describe('writeSeasonConfig', () => {
  it('writes slug, blizzardSeasonId, expansionId to config/season', async () => {
    const docMock = vi.fn();
    const setMock = vi.fn().mockResolvedValue(undefined);
    const dbMock = {
      doc: (path: string) => {
        docMock(path);
        return { set: setMock };
      },
    };
    const seasonInfo = { slug: 'season-mn-1', blizzardSeasonId: 17, expansionId: 11 };

    await writeSeasonConfig(dbMock as never, seasonInfo, () => 'TS');

    expect(docMock).toHaveBeenCalledWith('config/season');
    expect(setMock).toHaveBeenCalledWith({
      slug: 'season-mn-1',
      blizzardSeasonId: 17,
      expansionId: 11,
      fetchedAt: 'TS',
    });
  });
});
