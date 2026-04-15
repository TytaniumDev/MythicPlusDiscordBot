import fs from 'node:fs';
import * as config from './config.js';
import logger from './logger.js';
import { sanitizeForGithub, sanitizeLogs } from './security.js';

export class GitHubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface GitHubIssueResponse {
  number: number;
  html_url: string;
  title: string;
}

async function getRecentLogs(): Promise<string | null> {
  if (fs.existsSync(config.LOG_FILE)) {
    try {
      const content = fs.readFileSync(config.LOG_FILE, 'utf-8');
      const lines = content.split('\n');
      return lines.slice(-50).join('\n');
    } catch (e) {
      const errType = e instanceof Error ? e.constructor.name : String(e);
      logger.error(`Failed to read logs: ${errType}`);
    }
  }
  return null;
}

export function getVersionString(): string {
  if (config.GIT_SHA && config.GIT_SHA.length >= 7) {
    const shortSha = config.GIT_SHA.slice(0, 7);
    const commitUrl = `https://github.com/${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME}/commit/${config.GIT_SHA}`;
    return `[\`${shortSha}\`](${commitUrl})`;
  }
  return 'unknown';
}

export async function createGithubIssue(
  title: string,
  body: string,
  labels: string[],
): Promise<GitHubIssueResponse> {
  if (!config.GITHUB_TOKEN || !config.GITHUB_REPO_OWNER || !config.GITHUB_REPO_NAME) {
    throw new GitHubError(
      'GitHub configuration is missing. Please check your .env file.',
    );
  }

  const url = `https://api.github.com/repos/${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME}/issues`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `token ${config.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels }),
  });

  if (response.status === 201) {
    return (await response.json()) as GitHubIssueResponse;
  }
  throw new GitHubError(`Failed to create issue: HTTP ${response.status}`);
}

export async function searchGithubIssues(
  errorType: string,
): Promise<GitHubIssueResponse | null> {
  if (!config.GITHUB_TOKEN || !config.GITHUB_REPO_OWNER || !config.GITHUB_REPO_NAME) {
    return null;
  }

  const query = `repo:${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME} is:issue is:open label:auto-error ${errorType} in:title`;
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${config.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 200) {
      const data = (await response.json()) as Record<string, unknown>;
      const items = (data.items ?? []) as GitHubIssueResponse[];
      const totalCount = (data.total_count ?? 0) as number;
      if (totalCount > 0 && items.length > 0) {
        return items[0];
      }
    }
  } catch (e) {
    logger.warn(`Failed to search for existing GitHub issues: ${e}`);
  }
  return null;
}

export async function createErrorIssue(
  error: Error,
  contextInfo: string,
): Promise<GitHubIssueResponse | null> {
  if (!config.GITHUB_TOKEN) return null;

  try {
    const errorType = error.constructor.name;

    const existing = await searchGithubIssues(errorType);
    if (existing) {
      logger.info(
        `Skipping auto-error issue: existing open issue found for ${errorType}`,
      );
      return existing;
    }

    const errorMsg = sanitizeForGithub(String(error));
    const maxTitleMsg = 60;
    const shortMsg =
      errorMsg.length > maxTitleMsg ? errorMsg.slice(0, maxTitleMsg) + '...' : errorMsg;
    const title = `[Auto] ${errorType}: ${shortMsg}`;

    const safeContext = sanitizeForGithub(contextInfo);
    const safeTraceback = sanitizeForGithub(error.stack ?? '');
    const versionStr = getVersionString();

    let body =
      `**Version:** ${versionStr}\n\n` +
      `**Context:**\n\`\`\`\n${safeContext}\n\`\`\`\n\n` +
      `**Error:** \`${errorType}: ${errorMsg}\`\n\n` +
      `**Traceback:**\n\`\`\`\n${safeTraceback}\n\`\`\`\n`;

    const lastLines = await getRecentLogs();
    if (lastLines) {
      const safeLogs = sanitizeForGithub(lastLines);
      body += `\n**Recent Logs:**\n\`\`\`log\n${safeLogs}\n\`\`\`\n`;
    }

    return await createGithubIssue(title, body, ['bug', 'auto-error']);
  } catch (e) {
    const errType = e instanceof Error ? e.constructor.name : String(e);
    logger.error(`Failed to create automatic error issue: ${errType}`);
    return null;
  }
}

export interface GitHubIssueModalData {
  issueType: 'bug' | 'feature';
  title: string;
  description: string;
  extraInfo: string;
  includeLogs: boolean;
  reporterName: string;
  reporterId: string;
}

export async function submitGithubIssueModal(
  data: GitHubIssueModalData,
): Promise<GitHubIssueResponse> {
  const versionStr = getVersionString();
  const safeReporterName = sanitizeForGithub(data.reporterName);
  const safeReporterId = sanitizeForGithub(data.reporterId);
  const safeTitle = sanitizeForGithub(data.title);
  const safeDescription = sanitizeForGithub(data.description);

  let body =
    `**Reporter:** ${safeReporterName} (\`${safeReporterId}\`)\n` +
    `**Version:** ${versionStr}\n\n` +
    `**Description:**\n${safeDescription}\n`;

  if (data.extraInfo) {
    const safeExtraInfo = sanitizeForGithub(data.extraInfo);
    const sectionTitle =
      data.issueType === 'bug' ? 'Reproduction Steps' : 'Benefit/Impact';
    body += `\n**${sectionTitle}:**\n${safeExtraInfo}\n`;
  }

  if (data.issueType === 'bug' && data.includeLogs) {
    const lastLines = await getRecentLogs();
    if (lastLines) {
      const sanitizedLines = sanitizeLogs(lastLines);
      body += `\n**Recent Logs:**\n\`\`\`log\n${sanitizedLines}\n\`\`\`\n`;
    }
  }

  const labels = data.issueType === 'bug' ? ['bug'] : ['enhancement'];
  return createGithubIssue(safeTitle, body, labels);
}

export interface BadGroupReportData {
  reporterName: string;
  reporterId: string;
  title: string;
  description: string;
  players: { toTestString(): string }[];
  groups: { toTestString(): string }[];
}

export async function reportBadGroup(
  data: BadGroupReportData,
): Promise<GitHubIssueResponse> {
  const safeTitle = sanitizeForGithub(data.title);
  const safeDescription = sanitizeForGithub(data.description);
  const safeReporterName = sanitizeForGithub(data.reporterName);

  const formattedTitle = `[Bad Group] ${safeTitle}`;
  const versionStr = getVersionString();

  const reproInfo =
    `**Input Players:**\n\`\`\`python\n[${data.players.map((p) => p.toTestString()).join(', ')}]\n\`\`\`\n` +
    `**Resulting Groups:**\n\`\`\`python\n[${data.groups.map((g) => g.toTestString()).join(', ')}]\n\`\`\`\n`;

  let body =
    `**Reporter:** ${safeReporterName} (\`${sanitizeForGithub(String(data.reporterId))}\`)\n` +
    `**Version:** ${versionStr}\n\n` +
    `**Description:**\n${safeDescription}\n\n` +
    reproInfo;

  const lastLines = await getRecentLogs();
  if (lastLines) {
    const sanitizedLines = sanitizeLogs(lastLines);
    body += `\n**Recent Logs:**\n\`\`\`log\n${sanitizedLines}\n\`\`\`\n`;
  }

  return createGithubIssue(formattedTitle, body, ['bug', 'bad-group']);
}
