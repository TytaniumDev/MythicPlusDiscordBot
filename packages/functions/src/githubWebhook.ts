import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

export const githubWebhook = onRequest(async (req, res) => {
  // Basic validation: only POST requests
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const event = req.headers['x-github-event'] as string;
  const payload = req.body;

  if (!event || !payload) {
    res.status(400).send('Bad Request: Missing event or payload');
    return;
  }

  logger.info(`Received GitHub event: ${event}`, { action: payload.action });

  let issueNumber: number | null = null;
  let message = '';
  let url = '';

  if (event === 'issues') {
    issueNumber = payload.issue?.number;
    url = payload.issue?.html_url;
    const action = payload.action;
    message = `Issue #${issueNumber} was **${action}** by ${payload.sender?.login}.`;
  } else if (event === 'issue_comment') {
    issueNumber = payload.issue?.number;
    url = payload.comment?.html_url;
    const action = payload.action;
    if (action === 'created') {
      message = `${payload.sender?.login} **commented** on issue #${issueNumber}.`;
    } else {
      // Ignore other comment actions (edited, deleted) for now to avoid spam
      res.status(200).send('Ignored');
      return;
    }
  }

  if (issueNumber && message) {
    const db = getFirestore();
    const subRef = db.collection('issueSubscriptions').doc(String(issueNumber));
    const subDoc = await subRef.get();

    if (subDoc.exists) {
      const data = subDoc.data();
      const userIds = (data?.userIds as string[]) || [];

      if (userIds.length > 0) {
        const batch = db.batch();
        for (const userId of userIds) {
          const notificationRef = db.collection('notifications').doc();
          batch.set(notificationRef, {
            userId,
            issueNumber,
            message,
            url,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
        logger.info(`Queued ${userIds.length} notifications for issue #${issueNumber}`);
      }
    }
  }

  res.status(200).send('OK');
});
