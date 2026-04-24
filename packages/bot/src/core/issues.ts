import fs from 'node:fs';
import type { ModalSubmitInteraction } from 'discord.js';
import { IssueTrackingService } from '../services/issueTrackingService.js';

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



const issueTrackingService = new IssueTrackingService();

/**
 * Notifies the user who reported an issue via direct message.
 *
 * This function attempts to track the issue in the database first.
 * Then, it sends a direct message to the user containing a link to
 * the newly created issue so they can follow its progress.
 *
 * @param user - The user object representing the reporter. Must have an `id` and a `send` function.
 * @param issue - The GitHub issue response containing the issue URL and number.
 * @returns A boolean indicating whether the direct message was sent successfully.
 */
export async function notifyReporterOfIssue(
  user: { id: string; send: (content: string) => Promise<unknown> },
  issue: GitHubIssueResponse,
): Promise<boolean> {
  let tracked = false;
  try {
    await issueTrackingService.trackIssue({
      issueNumber: issue.number,
      discordUserId: user.id,
      issueUrl: issue.html_url,
      issueTitle: issue.title,
    });
    tracked = true;
  } catch (e) {
    logger.warn(`Failed to store issue tracking for #${issue.number}: ${e}`);
  }

  try {
    const trackingNote = tracked
      ? "\nI'll DM you when it's resolved."
      : '';
    await user.send(
      `Your report has been submitted! You can track it here: ${issue.html_url}${trackingNote}`,
    );
    return true;
  } catch {
    return false;
  }
}

import { WoWPlayer, WoWGroup } from '@mythicplus/shared';

export interface GroupServiceMinimal {
  lastResults: Map<string, {
    players: WoWPlayer[];
    groups: WoWGroup[];
  }>;
}

/**
 * Handles modal submit interactions from Discord.
 *
 * This function determines the type of modal submitted (e.g., bug report, feature request, or bad group report)
 * and dispatches to the appropriate helper function to create a GitHub issue. It extracts user input,
 * optional log attachments, and the current group generation state to build a detailed issue report.
 *
 * @param interaction - The modal submit interaction from discord.js.
 * @param groupService - A minimal representation of the GroupService containing the latest group results.
 */
export async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
  groupService: GroupServiceMinimal,
) {
  const customId = interaction.customId;
  const member = interaction.member as import('discord.js').GuildMember | null;
  const reporterName = member?.displayName ?? interaction.user.displayName;
  const reporterId = interaction.user.id;

  if (customId === 'bug_modal' || customId === 'feature_modal') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const extraInfo = customId === 'bug_modal'
        ? interaction.fields.getTextInputValue('steps')
        : interaction.fields.getTextInputValue('impact');
      const includeLogs = customId === 'bug_modal'
        ? interaction.fields.getTextInputValue('include_logs').toLowerCase().startsWith('y')
        : false;

      const issue = await submitGithubIssueModal({
        issueType: customId === 'bug_modal' ? 'bug' : 'feature',
        title,
        description,
        extraInfo,
        includeLogs,
        reporterName,
        reporterId,
      });
      const dmSent = await notifyReporterOfIssue(interaction.user, issue);
      const dmHint = dmSent ? '' : '\n(Enable DMs to get notified when this is resolved)';
      await interaction.editReply(`✅ Issue created: ${issue.html_url}${dmHint}`);
    } catch (e) {
      logger.error(`Failed to submit ${customId}: ${e}`);
      const msg = e instanceof Error ? e.message : String(e);
      await interaction.editReply(`❌ Failed to create issue: ${msg}`);
    }
    return;
  }

  if (customId === 'badgroup_modal') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const guildId = interaction.guild?.id ?? null;
      const lastResults = guildId ? groupService.lastResults.get(guildId) : undefined;
      if (!lastResults) {
        await interaction.editReply('❌ No group data found. Run /wheel first.');
        return;
      }

      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');

      const issue = await reportBadGroup({
        reporterName,
        reporterId,
        title,
        description,
        players: lastResults.players,
        groups: lastResults.groups,
      });
      const dmSent = await notifyReporterOfIssue(interaction.user, issue);
      const dmHint = dmSent ? '' : '\n(Enable DMs to get notified when this is resolved)';
      await interaction.editReply(`✅ Bad group reported: ${issue.html_url}${dmHint}`);
    } catch (e) {
      logger.error(`Failed to submit badgroup modal: ${e}`);
      const msg = e instanceof Error ? e.message : String(e);
      await interaction.editReply(`❌ Failed to create issue: ${msg}`);
    }
    return;
  }

  // Unknown modal — acknowledge to avoid Discord "did not respond" error
  await interaction.reply({ content: '❌ Unknown modal.', ephemeral: true });
}
