import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import type { GithubIssue } from './github.js';

/**
 * Remember who reported an issue, so `onGithubIssueWebhook` DMs them when it
 * closes. Resolves false instead of throwing: the issue exists either way.
 */
export async function trackIssue(issue: GithubIssue, discordId: string): Promise<boolean> {
  try {
    await getFirestore().collection('issueTracking').doc(String(issue.number)).set({
      discordUserId: discordId,
      issueUrl: issue.html_url,
      issueTitle: issue.title,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (e) {
    logger.error(`Failed to track issue #${issue.number}`, e);
    return false;
  }
}
