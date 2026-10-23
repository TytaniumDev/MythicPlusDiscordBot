import { WoWGroup, isRecord, obfuscatePii } from '@mythicplus/shared';
import type { WoWGroupDict } from '@mythicplus/shared';
import { GITHUB_REPO, type NewGithubIssue } from './github.js';

// Parsing and formatting for the reports players file from the activity. The
// issues are public, so every player-written field is cleaned before it goes
// into one.

export type IssueKind = 'bug' | 'feature';

/** A bug report or feature request. */
export interface IssueReport {
  kind: IssueKind;
  title: string;
  description: string;
  /** Reproduction steps for a bug, or the benefit of a feature. */
  details: string;
  reporterName: string;
  /** The activity build's commit hash, as the client reports it. */
  version: string;
}

/** A report that the groups of a lobby's current round look wrong. */
export interface BadGroupReport {
  channelId: string;
  title: string;
  description: string;
  reporterName: string;
  version: string;
}

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 2000;
const NAME_MAX = 100;
const VERSION_MAX = 40;

function requiredText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

function optionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length <= max ? text : null;
}

/** Validate a `reportIssue` request; null when any field is missing or too long. */
export function parseIssueReport(data: unknown): IssueReport | null {
  if (!isRecord(data)) return null;
  const kind = data.kind === 'bug' || data.kind === 'feature' ? data.kind : null;
  const title = requiredText(data.title, TITLE_MAX);
  const description = requiredText(data.description, DESCRIPTION_MAX);
  const details = optionalText(data.details, DESCRIPTION_MAX);
  const reporterName = optionalText(data.reporterName, NAME_MAX);
  const version = optionalText(data.version, VERSION_MAX);
  if (!kind || !title || !description || details === null || reporterName === null || version === null) {
    return null;
  }
  return { kind, title, description, details, reporterName, version };
}

/** Validate a `reportBadGroup` request; null when any field is missing or too long. */
export function parseBadGroupReport(data: unknown): BadGroupReport | null {
  if (!isRecord(data)) return null;
  const channelId = typeof data.channelId === 'string' && /^[0-9]{1,32}$/.test(data.channelId)
    ? data.channelId
    : null;
  const title = requiredText(data.title, TITLE_MAX);
  const description = requiredText(data.description, DESCRIPTION_MAX);
  const reporterName = optionalText(data.reporterName, NAME_MAX);
  const version = optionalText(data.version, VERSION_MAX);
  if (!channelId || !title || !description || reporterName === null || version === null) return null;
  return { channelId, title, description, reporterName, version };
}

/**
 * Make player-written text safe for a public issue: Discord IDs and names are
 * redacted, and `@` mentions are broken up so an issue can't ping anyone.
 */
export function cleanForIssue(text: string): string {
  return obfuscatePii(text).replace(/@(?=[A-Za-z0-9])/g, '@​');
}

/** A link to the commit the activity was built from, or "unknown". */
export function versionLink(version: string): string {
  if (!/^[0-9a-f]{7,40}$/.test(version)) return 'unknown';
  const url = `https://github.com/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/commit/${version}`;
  return `[\`${version.slice(0, 7)}\`](${url})`;
}

function header(reporterName: string, version: string): string {
  const reporter = reporterName ? cleanForIssue(reporterName) : 'Unknown';
  return `**Reporter:** ${reporter}\n**Version:** ${versionLink(version)}\n**Sent from:** the Wheelson activity\n\n`;
}

export function formatIssueReport(report: IssueReport): NewGithubIssue {
  let body = header(report.reporterName, report.version)
    + `**Description:**\n${cleanForIssue(report.description)}\n`;
  if (report.details) {
    const heading = report.kind === 'bug' ? 'Reproduction Steps' : 'Benefit/Impact';
    body += `\n**${heading}:**\n${cleanForIssue(report.details)}\n`;
  }
  return {
    title: cleanForIssue(report.title),
    body,
    labels: report.kind === 'bug' ? ['bug'] : ['enhancement'],
  };
}

/**
 * The issue for a bad-group report: the round's players and groups as test
 * code, plus the day's earlier rounds, since the algorithm's pair scoring
 * depends on them.
 */
export function formatBadGroupReport(
  report: BadGroupReport,
  groupDicts: WoWGroupDict[],
  priorRoundDicts: WoWGroupDict[][],
): NewGithubIssue {
  const groups = groupDicts.map((g) => WoWGroup.fromDict({ ...g }));
  const players = groups.flatMap((g) => g.players);

  let body = header(report.reporterName, report.version)
    + `**Description:**\n${cleanForIssue(report.description)}\n\n`
    + `**Input Players:**\n\`\`\`python\n[${players.map((p) => p.toTestString()).join(', ')}]\n\`\`\`\n`
    + `**Resulting Groups:**\n\`\`\`python\n[${groups.map((g) => g.toTestString()).join(', ')}]\n\`\`\`\n`;

  if (priorRoundDicts.length > 0) {
    const rounds = priorRoundDicts
      .map((round, i) => {
        const roundGroups = round.map((g) => WoWGroup.fromDict({ ...g }).toTestString());
        return `Round ${i + 1}: [${roundGroups.join(', ')}]`;
      })
      .join('\n');
    body += `**Prior Rounds:**\n\`\`\`python\n${rounds}\n\`\`\`\n`;
  }

  return {
    title: `[Bad Group] ${cleanForIssue(report.title)}`,
    body,
    labels: ['bug', 'bad-group'],
  };
}
