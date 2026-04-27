import { createHmac, timingSafeEqual } from 'node:crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

const discordBotToken = defineSecret('BOT_TOKEN');
const githubWebhookSecret = defineSecret('GITHUB_WEBHOOK_SECRET');

const DISCORD_API = 'https://discord.com/api/v10';

export function verifyGithubSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  try {
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expectedBuffer.length) {
      // Avoid timing leak by comparing expected with itself when lengths mismatch
      timingSafeEqual(expectedBuffer, expectedBuffer);
      return false;
    }
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function sendDiscordDm(
  botToken: string,
  userId: string,
  content: string,
): Promise<void> {
  const headers = {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json',
  };

  // Open DM channel
  const channelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!channelRes.ok) {
    throw new Error(`Failed to open DM channel: ${channelRes.status}`);
  }
  const channel = (await channelRes.json()) as { id: string };

  // Send message
  const msgRes = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });
  if (!msgRes.ok) {
    throw new Error(`Failed to send DM message: ${msgRes.status}`);
  }
}

interface WebhookPayload {
  action: string;
  issue: { number: number };
}

export async function handleIssueWebhook(
  payload: WebhookPayload,
  botToken: string,
): Promise<'notified' | 'ignored' | 'no-tracking'> {
  if (payload.action !== 'closed') return 'ignored';

  const db = getFirestore();
  const docRef = db.collection('issueTracking').doc(String(payload.issue.number));
  const doc = await docRef.get();

  if (!doc.exists) return 'no-tracking';

  const data = doc.data() as {
    discordUserId: string;
    issueUrl: string;
    issueTitle: string;
  };

  try {
    await sendDiscordDm(
      botToken,
      data.discordUserId,
      `Your issue "${data.issueTitle}" has been resolved!\n${data.issueUrl}`,
    );
  } catch (e) {
    logger.warn(`Failed to DM user ${data.discordUserId}`, e);
  }

  await docRef.delete();
  return 'notified';
}

export const onGithubIssueWebhook = onRequest(
  { secrets: [discordBotToken, githubWebhookSecret] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const rawBody = ((req as unknown as { rawBody: Buffer }).rawBody ?? '').toString();
    const signature = req.headers['x-hub-signature-256'] as string;

    if (!verifyGithubSignature(rawBody, signature, githubWebhookSecret.value())) {
      res.status(401).send('Invalid signature');
      return;
    }

    const eventType = req.headers['x-github-event'];
    if (eventType !== 'issues') {
      res.status(200).json({ result: 'ignored' });
      return;
    }

    const payload = req.body as WebhookPayload;
    const result = await handleIssueWebhook(payload, discordBotToken.value());

    res.status(200).json({ result });
  },
);
