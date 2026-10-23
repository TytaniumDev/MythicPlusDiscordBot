import { describe, it, expect } from 'vitest';
import type { WoWGroupDict, WoWPlayerDict } from '@mythicplus/shared';
import {
  cleanForIssue,
  formatBadGroupReport,
  formatIssueReport,
  parseBadGroupReport,
  parseIssueReport,
  versionLink,
  type IssueReport,
} from '../src/issueReports';

function player(name: string, mainRole: WoWPlayerDict['mainRole']): WoWPlayerDict {
  return { name, discordId: `${name}-id`, inGameName: '', mainRole, offspecs: [], utilities: [] };
}

const GROUP: WoWGroupDict = {
  tank: player('Tankone', 'tank'),
  healer: player('Healone', 'healer'),
  dps: [player('Dpsone', 'ranged'), player('Dpstwo', 'melee'), player('Dpsthree', 'ranged')],
};

const BUG: IssueReport = {
  kind: 'bug',
  title: 'Wheel stuck',
  description: 'It stopped spinning.',
  details: '',
  reporterName: 'Ty',
  version: 'abcdef1234567',
};

describe('parseIssueReport', () => {
  it('trims fields and defaults the optional ones', () => {
    expect(parseIssueReport({ kind: 'feature', title: ' Dark mode ', description: ' Please ' })).toEqual({
      kind: 'feature',
      title: 'Dark mode',
      description: 'Please',
      details: '',
      reporterName: '',
      version: '',
    });
  });

  it('rejects an unknown kind, blank or long text and non-objects', () => {
    expect(parseIssueReport({ ...BUG, kind: 'question' })).toBeNull();
    expect(parseIssueReport({ ...BUG, title: '   ' })).toBeNull();
    expect(parseIssueReport({ ...BUG, title: 'x'.repeat(101) })).toBeNull();
    expect(parseIssueReport({ ...BUG, description: 'x'.repeat(2001) })).toBeNull();
    expect(parseIssueReport({ ...BUG, reporterName: 42 })).toBeNull();
    expect(parseIssueReport('bug')).toBeNull();
  });
});

describe('parseBadGroupReport', () => {
  const report = { channelId: '1234', title: 'Two tanks', description: 'Both in group 1', reporterName: 'Ty', version: '' };

  it('accepts a report for a Discord channel ID', () => {
    expect(parseBadGroupReport(report)).toEqual(report);
  });

  it('rejects a channel ID that is not a Discord ID', () => {
    expect(parseBadGroupReport({ ...report, channelId: '../guilds/1' })).toBeNull();
    expect(parseBadGroupReport({ ...report, channelId: undefined })).toBeNull();
  });
});

describe('cleanForIssue', () => {
  it('redacts Discord IDs and breaks up mentions', () => {
    const cleaned = cleanForIssue('ping @TytaniumDev about 123456789012345678');
    expect(cleaned).not.toContain('123456789012345678');
    expect(cleaned).not.toContain('@TytaniumDev');
    expect(cleaned).toContain('@​TytaniumDev');
  });
});

describe('versionLink', () => {
  it('links a commit hash and shows "unknown" otherwise', () => {
    expect(versionLink('abcdef1234567')).toBe(
      '[`abcdef1`](https://github.com/TytaniumDev/MythicPlusDiscordBot/commit/abcdef1234567)',
    );
    expect(versionLink('dev')).toBe('unknown');
    expect(versionLink('')).toBe('unknown');
  });
});

describe('formatIssueReport', () => {
  it('labels a bug and adds its reproduction steps', () => {
    const issue = formatIssueReport({ ...BUG, details: 'Press Spin twice' }, 'activity');
    expect(issue.title).toBe('Wheel stuck');
    expect(issue.labels).toEqual(['bug']);
    expect(issue.body).toContain('**Reporter:** Ty');
    expect(issue.body).toContain('**Sent from:** the Wheelson activity');
    expect(issue.body).toContain('**Description:**\nIt stopped spinning.');
    expect(issue.body).toContain('**Reproduction Steps:**\nPress Spin twice');
  });

  it('labels a feature request and leaves out empty details', () => {
    const issue = formatIssueReport({ ...BUG, kind: 'feature' }, 'discord');
    expect(issue.body).toContain('**Sent from:** a Wheelson slash command');
    expect(issue.labels).toEqual(['enhancement']);
    expect(issue.body).not.toContain('Benefit/Impact');
  });
});

describe('formatBadGroupReport', () => {
  const report = { channelId: '1234', title: 'Two tanks', description: 'Both in group 1', reporterName: '', version: '' };

  it('lists the players and groups as test code', () => {
    const issue = formatBadGroupReport(report, [GROUP], []);
    expect(issue.title).toBe('[Bad Group] Two tanks');
    expect(issue.labels).toEqual(['bug', 'bad-group']);
    expect(issue.body).toContain('**Reporter:** Unknown');
    expect(issue.body).toContain('WoWPlayer.create("Tankone", ["Tank"])');
    expect(issue.body).toContain('WoWGroup(Tank=');
    expect(issue.body).not.toContain('Prior Rounds');
  });

  it('adds the earlier rounds', () => {
    const issue = formatBadGroupReport(report, [GROUP], [[GROUP], [GROUP]]);
    expect(issue.body).toContain('**Prior Rounds:**');
    expect(issue.body).toContain('Round 1: [WoWGroup(');
    expect(issue.body).toContain('Round 2: [WoWGroup(');
  });
});
