import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { discordIdFromAuth } from './auth.js';
import { sendDiscordDm } from './discordApi.js';
import { createGithubIssue, type GithubIssue } from './github.js';
import { formatIssueReport, parseIssueReport } from './issueReports.js';
import { enforceRateLimit } from './rateLimit.js';

const githubIssuesToken = defineSecret('GITHUB_ISSUES_TOKEN');
const discordBotToken = defineSecret('BOT_TOKEN');

/**
 * Track the issue so `onGithubIssueWebhook` DMs the reporter when it closes,
 * then DM them the link. Neither step fails the report: the issue exists.
 */
async function followUp(issue: GithubIssue, discordId: string, botToken: string): Promise<void> {
  let tracked = false;
  try {
    await getFirestore().collection('issueTracking').doc(String(issue.number)).set({
      discordUserId: discordId,
      issueUrl: issue.html_url,
      issueTitle: issue.title,
      createdAt: FieldValue.serverTimestamp(),
    });
    tracked = true;
  } catch (e) {
    logger.error(`Failed to track issue #${issue.number}`, e);
  }

  const note = tracked ? "\nI'll DM you when it's resolved." : '';
  try {
    await sendDiscordDm(botToken, discordId, `Your report has been submitted! You can track it here: ${issue.html_url}${note}`);
  } catch (e) {
    logger.warn(`Failed to DM reporter ${discordId} about issue #${issue.number}`, e);
  }
}

/**
 * File a bug report or feature request from the activity as a GitHub issue.
 * Only players signed in with Discord can, so Wheelson knows whom to DM when
 * the issue is resolved.
 */
export const reportIssue = onCall(
  { secrets: [githubIssuesToken, discordBotToken] },
  async (request) => {
    const discordId = discordIdFromAuth(request.auth);
    if (!discordId) {
      throw new HttpsError('permission-denied', 'Sign in with Discord to send a report');
    }
    await enforceRateLimit(discordId, 'reportIssue', 5, 60 * 60 * 1000);

    const report = parseIssueReport(request.data);
    if (!report) {
      throw new HttpsError('invalid-argument', 'A report needs a kind, a title and a description');
    }

    let issue: GithubIssue;
    try {
      issue = await createGithubIssue(githubIssuesToken.value().trim(), formatIssueReport(report));
    } catch (e) {
      logger.error('Failed to create GitHub issue for a report', e);
      throw new HttpsError('unavailable', 'Could not file the report');
    }

    await followUp(issue, discordId, discordBotToken.value().trim());
    return { issueUrl: issue.html_url, issueNumber: issue.number };
  },
);
