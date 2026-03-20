import { describe, it, expect } from 'vitest';
import { buildAffixDocument } from '../src/fetchWeeklyAffixes';

describe('buildAffixDocument', () => {
  it('maps Battle.net period response to affix display data', () => {
    const periodData = {
      id: 1000,
      affix_details: [
        { id: 160, name: "Xal'atath's Bargain: Devour" },
        { id: 10, name: 'Fortified' },
        { id: 165, name: "Lindormi's Guidance" },
        { id: 147, name: "Xal'atath's Guile" },
      ],
    };

    const result = buildAffixDocument(periodData, 'us');

    expect(result.period).toBe(1000);
    expect(result.region).toBe('us');
    expect(result.affixes).toHaveLength(4);
    // Should be sorted: Lindormi's (0) → Devour (1) → Fortified (2) → Guile (3)
    expect(result.affixes[0].id).toBe(165);
    expect(result.affixes[1].id).toBe(160);
    expect(result.affixes[2].id).toBe(10);
    expect(result.affixes[3].id).toBe(147);

    const devour = result.affixes.find(a => a.id === 160);
    expect(devour).toMatchObject({
      nickname: 'dispel',
      keystoneLevel: '+4–11',
      color: '#a855f7',
    });
  });

  it('skips unknown affix IDs', () => {
    const periodData = {
      id: 1000,
      affix_details: [
        { id: 99999, name: 'Unknown Affix' },
        { id: 10, name: 'Fortified' },
      ],
    };

    const result = buildAffixDocument(periodData, 'us');
    expect(result.affixes).toHaveLength(1);
    expect(result.affixes[0].id).toBe(10);
  });
});
