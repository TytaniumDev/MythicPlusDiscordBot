import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STATIC_AFFIXES } from '@mythicplus/shared';
import type { WoWPlayerDict } from '@mythicplus/shared';
import {
  decodeAffixData,
  decodeChannelData,
  decodeGuildData,
  reportDecodeIssues,
} from './firestoreDecoders';
import { reportError } from '../lib/sentry';

vi.mock('../lib/sentry', () => ({ reportError: vi.fn() }));

function player(name: string): WoWPlayerDict {
  return { name, discordId: `${name}-id`, inGameName: '', mainRole: 'tank', offspecs: [], utilities: [] };
}

const validChannel = {
  channelId: 'c1',
  channelName: 'M+ Lobby',
  guildId: 'g1',
  status: 'completed',
  members: [{ discordId: '1', name: 'Ay' }],
  groups: [{ tank: player('t'), healer: null, dps: [player('d')] }],
  revealedGroups: 1,
  claimedPlayers: ['1'],
  sittingOut: [],
  staticWheel: false,
  isDebug: true,
  createdAt: 'ts-created',
  lastActive: 'ts-active',
};

describe('decodeChannelData', () => {
  it('passes a valid doc through with no issues', () => {
    expect(decodeChannelData(validChannel, 'c1')).toEqual({ value: validChannel, issues: [] });
  });

  it('defaults a minimal doc the activity itself creates', () => {
    const { value, issues } = decodeChannelData(
      { channelId: 'c1', channelName: '', guildId: 'g1', status: 'lobby', groups: [], isDebug: false },
      'c1',
    );
    expect(issues).toEqual([]);
    expect(value).toMatchObject({ status: 'lobby', groups: [], isDebug: false });
    expect(value.members).toBeUndefined();
    expect(value.sittingOut).toBeUndefined();
  });

  it('degrades a malformed doc to safe defaults and lists the issues', () => {
    const { value, issues } = decodeChannelData({
      channelId: 5,
      guildId: 'g1',
      status: 'finished',
      members: [{ discordId: '1', name: 'Ay' }, { name: 'no id' }],
      groups: [{ tank: { mainRole: 'tank' }, healer: player('h'), dps: [] }, 'junk'],
      revealedGroups: -1,
      sittingOut: ['1', 2],
      isDebug: 'yes',
    }, 'c1');
    expect(value).toMatchObject({
      channelId: 'c1',
      channelName: '',
      status: 'lobby',
      members: [{ discordId: '1', name: 'Ay' }],
      groups: [{ tank: null, healer: player('h'), dps: [] }],
      revealedGroups: undefined,
      sittingOut: ['1'],
      isDebug: false,
    });
    expect(issues).toEqual([
      'status: invalid',
      'members: dropped 1 invalid entries',
      'groups[0] tank: invalid player',
      'groups[1]: not an object',
      'revealedGroups: invalid',
      'channelId: not a string',
      'sittingOut: dropped 1 non-string entries',
      'isDebug: not a boolean',
    ]);
  });

  it('handles a doc that is not an object', () => {
    const { value, issues } = decodeChannelData(undefined, 'c1');
    expect(value).toMatchObject({ channelId: 'c1', guildId: '', status: 'lobby', groups: [] });
    expect(issues).toContain('doc: not an object');
  });
});

describe('decodeGuildData', () => {
  it('decodes a valid doc, including wrapped group history and season pairs', () => {
    const round = [{ tank: player('t'), healer: player('h'), dps: [] }];
    const { value, issues } = decodeGuildData({
      guildId: 'g1',
      guildName: 'Guild',
      voiceChannels: [{ id: 'v1', name: 'Voice', userCount: 3 }],
      groupHistory: { date: '2026-09-28', rounds: [{ groups: round }] },
      seasonPairs: { seasonSlug: 's1', counts: { 'a|b': 1 } },
    }, 'g1');
    expect(issues).toEqual([]);
    expect(value).toMatchObject({
      guildId: 'g1',
      guildName: 'Guild',
      voiceChannels: [{ id: 'v1', name: 'Voice', userCount: 3 }],
      groupHistory: { date: '2026-09-28', rounds: [round] },
      seasonPairs: { seasonSlug: 's1', counts: { 'a|b': 1 } },
    });
  });

  it('drops malformed parts and keeps the rest', () => {
    const { value, issues } = decodeGuildData({
      voiceChannels: [{ id: 'v1', name: 'Voice', userCount: 3 }, { id: 'v2' }],
      groupHistory: { date: 20260928, rounds: [] },
      seasonPairs: { counts: {} },
    }, 'g1');
    expect(value.guildId).toBe('g1');
    expect(value.voiceChannels).toEqual([{ id: 'v1', name: 'Voice', userCount: 3 }]);
    expect(value.groupHistory).toBeUndefined();
    expect(value.seasonPairs).toBeUndefined();
    expect(issues).toEqual([
      'seasonPairs: invalid',
      'guildId: missing',
      'voiceChannels[1]: invalid',
      'groupHistory: invalid',
    ]);
  });
});

describe('decodeAffixData', () => {
  const fortified = STATIC_AFFIXES[0];

  it('passes valid affixes through', () => {
    expect(decodeAffixData({ period: 3, region: 'eu', affixes: [fortified] })).toEqual({
      value: { period: 3, region: 'eu', affixes: [fortified] },
      issues: [],
    });
  });

  it('drops invalid affixes, including non-https links', () => {
    const { value, issues } = decodeAffixData({
      period: 0,
      region: 'us',
      affixes: [fortified, { ...fortified, wowheadUrl: 'javascript:alert(1)' }, { id: 'x' }],
    });
    expect(value.affixes).toEqual([fortified]);
    expect(issues).toEqual(['affixes[1]: invalid', 'affixes[2]: invalid']);
  });

  it('falls back to the static affixes when none are usable', () => {
    const { value, issues } = decodeAffixData({ affixes: 'nope' });
    expect(value).toEqual({ period: 0, region: 'us', affixes: STATIC_AFFIXES });
    expect(issues).toEqual(['affixes: not an array']);
  });
});

describe('reportDecodeIssues', () => {
  beforeEach(() => vi.mocked(reportError).mockClear());

  it('does nothing without issues', () => {
    reportDecodeIssues('tag', 'channels/none', []);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports each distinct set of issues for a doc once', () => {
    reportDecodeIssues('tag', 'channels/dedupe', ['status: invalid']);
    reportDecodeIssues('tag', 'channels/dedupe', ['status: invalid']);
    reportDecodeIssues('tag', 'channels/dedupe', ['groups: not an array']);
    expect(reportError).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      tag: 'tag',
      extra: { path: 'channels/dedupe', issues: ['status: invalid'] },
    });
  });
});
