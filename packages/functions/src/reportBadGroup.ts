import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { decodeGroupHistoryRounds, isRecord, parseWoWGroupDicts, todayPST } from '@mythicplus/shared';
import type { WoWGroupDict } from '@mythicplus/shared';
import { createGithubIssue } from './github.js';
import { formatBadGroupReport, parseBadGroupReport } from './issueReports.js';
import { enforceRateLimit } from './rateLimit.js';

const githubIssuesToken = defineSecret('GITHUB_ISSUES_TOKEN');

/**
 * The guild's rounds before the current one, today. The round being reported
 * is the last one `startSpin` added to the history.
 */
export function priorRounds(groupHistory: unknown, today: string): WoWGroupDict[][] {
  if (!isRecord(groupHistory) || groupHistory.date !== today) return [];
  return decodeGroupHistoryRounds(groupHistory.rounds).slice(0, -1);
}

/**
 * File a GitHub issue saying a lobby's current groups look wrong. The groups
 * and the day's earlier rounds are read from Firestore rather than taken from
 * the client, so the issue shows exactly what the algorithm produced. Open to
 * every player, anonymous ones included.
 */
export const reportBadGroup = onCall(
  { secrets: [githubIssuesToken] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    await enforceRateLimit(request.auth.uid, 'reportBadGroup', 3, 10 * 60 * 1000);
    // Anonymous accounts are free to make, so also cap reports overall.
    await enforceRateLimit('global', 'reportBadGroup', 30, 60 * 60 * 1000);

    const report = parseBadGroupReport(request.data);
    if (!report) {
      throw new HttpsError('invalid-argument', 'A report needs a lobby, a title and a description');
    }

    const db = getFirestore();
    const lobby = (await db.doc(`channels/${report.channelId}`).get()).data();
    const groups = parseWoWGroupDicts(lobby?.groups).value;
    if (!lobby || groups.length === 0) {
      throw new HttpsError('failed-precondition', 'This lobby has no groups to report');
    }
    const guildId = typeof lobby.guildId === 'string' ? lobby.guildId : '';
    const guild = guildId ? (await db.doc(`guilds/${guildId}`).get()).data() : undefined;

    try {
      const issue = await createGithubIssue(
        githubIssuesToken.value().trim(),
        formatBadGroupReport(report, groups, priorRounds(guild?.groupHistory, todayPST())),
      );
      return { issueUrl: issue.html_url, issueNumber: issue.number };
    } catch (e) {
      logger.error('Failed to create GitHub issue for a bad-group report', e);
      throw new HttpsError('unavailable', 'Could not file the report');
    }
  },
);
