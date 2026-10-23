import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { fetchVerifyKey } from './discordApi.js';
import { verifyDiscordSignature } from './discordSignature.js';
import { createGithubIssue } from './github.js';
import { formatIssueReport } from './issueReports.js';
import { trackIssue } from './issueTracking.js';
import { enforceRateLimit } from './rateLimit.js';
import { handleInteraction, type FileReport } from './reportCommands.js';

const discordBotToken = defineSecret('BOT_TOKEN');
const githubIssuesToken = defineSecret('GITHUB_ISSUES_TOKEN');

// Read once per instance; a failed read is retried on the next request.
let verifyKey: Promise<string> | null = null;

function loadVerifyKey(botToken: string): Promise<string> {
  verifyKey ??= fetchVerifyKey(botToken).catch((e: unknown) => {
    verifyKey = null;
    throw e;
  });
  return verifyKey;
}

const fileReport: FileReport = async (report, discordId) => {
  await enforceRateLimit(discordId, 'reportIssue', 5, 60 * 60 * 1000);
  const issue = await createGithubIssue(githubIssuesToken.value().trim(), formatIssueReport(report, 'discord'));
  return { issue, tracked: await trackIssue(issue, discordId) };
};

/**
 * Wheelson's Discord interactions endpoint (the Interactions Endpoint URL in
 * the Developer Portal): `/bug` and `/featurerequest`, in servers and in DMs.
 * Discord expects an answer within 3 seconds, so the issue is filed before
 * responding.
 */
export const discordInteractions = onRequest(
  { secrets: [discordBotToken, githubIssuesToken] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    let key: string;
    try {
      key = await loadVerifyKey(discordBotToken.value().trim());
    } catch (e) {
      logger.error('Could not read the Discord verify key', e);
      res.status(500).send('Not configured');
      return;
    }

    const rawBody = ((req as unknown as { rawBody?: Buffer }).rawBody ?? '').toString();
    const signature = req.get('x-signature-ed25519') ?? '';
    const timestamp = req.get('x-signature-timestamp') ?? '';
    if (!verifyDiscordSignature(key, signature, timestamp, rawBody)) {
      res.status(401).send('Invalid request signature');
      return;
    }

    res.status(200).json(await handleInteraction(req.body, fileReport));
  },
);
