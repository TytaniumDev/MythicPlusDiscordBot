# Issue Reporter Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DM Discord users a link when their bug/feature issue is created on GitHub, and DM them again when it's closed.

**Architecture:** The bot writes a Firestore mapping (`issueTracking/{issueNumber}`) after creating each GitHub issue, then DMs the reporter. A new Cloud Function receives a GitHub webhook on issue close, looks up the mapping, DMs the reporter via the Discord REST API, and deletes the mapping.

**Tech Stack:** Firebase Cloud Functions (v2 HTTPS), Firestore, Discord REST API, GitHub webhooks, vitest

---

### Task 1: Issue Tracking Service (Bot)

A thin Firestore service for storing and retrieving issue-to-Discord-user mappings.

**Files:**
- Create: `packages/bot/src/services/issueTrackingService.ts`
- Create: `packages/bot/tests/issueTrackingService.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/bot/tests/issueTrackingService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSet = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();
const mockDoc = vi.fn().mockReturnValue({ set: mockSet, delete: mockDelete, get: mockGet });
const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });

vi.mock('../src/core/firebaseService.js', () => ({
  FirebaseService: {
    getInstance: () => ({
      db: { collection: mockCollection },
      isAvailable: () => true,
    }),
  },
  SERVER_TIMESTAMP: 'SERVER_TIMESTAMP',
}));

import { IssueTrackingService } from '../src/services/issueTrackingService.js';

describe('IssueTrackingService', () => {
  let service: IssueTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IssueTrackingService();
  });

  describe('trackIssue', () => {
    it('writes a document to the issueTracking collection', async () => {
      await service.trackIssue({
        issueNumber: 42,
        discordUserId: '123456789',
        issueUrl: 'https://github.com/owner/repo/issues/42',
        issueTitle: 'Fix the thing',
      });

      expect(mockCollection).toHaveBeenCalledWith('issueTracking');
      expect(mockDoc).toHaveBeenCalledWith('42');
      expect(mockSet).toHaveBeenCalledWith({
        discordUserId: '123456789',
        issueUrl: 'https://github.com/owner/repo/issues/42',
        issueTitle: 'Fix the thing',
        createdAt: 'SERVER_TIMESTAMP',
      });
    });
  });

  describe('deleteTracking', () => {
    it('deletes the document from the issueTracking collection', async () => {
      await service.deleteTracking(42);

      expect(mockCollection).toHaveBeenCalledWith('issueTracking');
      expect(mockDoc).toHaveBeenCalledWith('42');
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm -w packages/bot run test -- --run issueTrackingService`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// packages/bot/src/services/issueTrackingService.ts
import { FirebaseService, SERVER_TIMESTAMP } from '../core/firebaseService.js';

export interface TrackIssueData {
  issueNumber: number;
  discordUserId: string;
  issueUrl: string;
  issueTitle: string;
}

export class IssueTrackingService {
  async trackIssue(data: TrackIssueData): Promise<void> {
    const firebase = FirebaseService.getInstance();
    if (!firebase.db) return;

    const docRef = firebase.db.collection('issueTracking').doc(String(data.issueNumber));
    await docRef.set({
      discordUserId: data.discordUserId,
      issueUrl: data.issueUrl,
      issueTitle: data.issueTitle,
      createdAt: SERVER_TIMESTAMP,
    });
  }

  async deleteTracking(issueNumber: number): Promise<void> {
    const firebase = FirebaseService.getInstance();
    if (!firebase.db) return;

    const docRef = firebase.db.collection('issueTracking').doc(String(issueNumber));
    await docRef.delete();
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm -w packages/bot run test -- --run issueTrackingService`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/bot/src/services/issueTrackingService.ts packages/bot/tests/issueTrackingService.test.ts
git commit -m "feat: add IssueTrackingService for Firestore issue-to-user mapping"
```

---

### Task 2: Type the GitHub Issue Response

Currently `createGithubIssue` returns `Record<string, unknown>`. Add a typed return so callers can safely access `number`, `html_url`, and `title`.

**Files:**
- Modify: `packages/bot/src/core/issues.ts:36-62`
- Modify: `packages/bot/tests/issues.test.ts`

- [ ] **Step 1: Write a failing test for the typed return**

Add this test to the existing `createGithubIssue` describe block in `packages/bot/tests/issues.test.ts`:

```ts
  it('returns typed issue data with number, html_url, and title', async () => {
    setConfig({ GITHUB_TOKEN: 'fake_token' });

    global.fetch = vi.fn().mockResolvedValue({
      status: 201,
      json: vi.fn().mockResolvedValue({
        number: 42,
        html_url: 'http://github.com/issue/42',
        title: 'Test Issue',
      }),
    });

    const result = await createGithubIssue('Test Issue', 'Body', ['bug']);
    expect(result.number).toBe(42);
    expect(result.html_url).toBe('http://github.com/issue/42');
    expect(result.title).toBe('Test Issue');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm -w packages/bot run test -- --run issues`
Expected: FAIL — TypeScript error (property `number` does not exist on `Record<string, unknown>`)

- [ ] **Step 3: Add the return type and update the function**

In `packages/bot/src/core/issues.ts`, add the interface and update the function signature:

```ts
// Add near the top of the file (after GitHubError class, before getRecentLogs)
export interface GitHubIssueResponse {
  number: number;
  html_url: string;
  title: string;
}
```

Update `createGithubIssue` return type:

```ts
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
```

Update `submitGithubIssueModal` and `reportBadGroup` return types to `Promise<GitHubIssueResponse>`.

Update `createErrorIssue` return type to `Promise<GitHubIssueResponse | null>` and `searchGithubIssues` to `Promise<GitHubIssueResponse | null>`.

- [ ] **Step 4: Run all issue tests to verify they pass**

Run: `npm -w packages/bot run test -- --run issues`
Expected: PASS (all existing tests should still pass since `GitHubIssueResponse` is a superset)

- [ ] **Step 5: Commit**

```bash
git add packages/bot/src/core/issues.ts packages/bot/tests/issues.test.ts
git commit -m "refactor: type createGithubIssue return as GitHubIssueResponse"
```

---

### Task 3: DM Reporter + Store Tracking on Issue Creation

Wire the bot's issue creation paths to store the Firestore mapping and DM the reporter.

**Files:**
- Modify: `packages/bot/src/main.ts:36-37` (imports)
- Modify: `packages/bot/src/main.ts:784-808` (quick bug path)
- Modify: `packages/bot/src/main.ts:854-878` (quick feature path)
- Modify: `packages/bot/src/main.ts:1086-1154` (modal submit handler)

- [ ] **Step 1: Add a helper function for DM + tracking**

Add a helper near the top of `main.ts` (after imports, before the slash command definitions) that handles both the Firestore write and the DM attempt. This avoids duplicating logic across all 5 paths.

At the import section (~line 36), add:

```ts
import { IssueTrackingService } from './services/issueTrackingService.js';
import type { GitHubIssueResponse } from './core/issues.js';
```

After the import block, add the service instance and helper:

```ts
const issueTrackingService = new IssueTrackingService();

async function notifyReporterOfIssue(
  user: { id: string; send: (content: string) => Promise<unknown> },
  issue: GitHubIssueResponse,
): Promise<boolean> {
  try {
    await issueTrackingService.trackIssue({
      issueNumber: issue.number,
      discordUserId: user.id,
      issueUrl: issue.html_url,
      issueTitle: issue.title,
    });
  } catch (e) {
    logger.warn(`Failed to store issue tracking for #${issue.number}: ${e}`);
  }

  try {
    await user.send(
      `Your report has been submitted! You can track it here: ${issue.html_url}\nI'll DM you when it's resolved.`,
    );
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Update the quick bug path**

In `packages/bot/src/main.ts`, replace the success reply in the quick bug path (~line 802):

Before:
```ts
            await sender.send(`✅ Bug reported: ${issue.html_url}`);
```

After:
```ts
            const dmSent = await notifyReporterOfIssue(interaction.user, issue);
            const dmHint = dmSent ? '' : '\n(Enable DMs to get notified when this is resolved)';
            await sender.send(`✅ Bug reported: ${issue.html_url}${dmHint}`);
```

- [ ] **Step 3: Update the quick feature path**

Same pattern in the quick feature path (~line 872):

Before:
```ts
            await sender.send(`✅ Feature request created: ${issue.html_url}`);
```

After:
```ts
            const dmSent = await notifyReporterOfIssue(interaction.user, issue);
            const dmHint = dmSent ? '' : '\n(Enable DMs to get notified when this is resolved)';
            await sender.send(`✅ Feature request created: ${issue.html_url}${dmHint}`);
```

- [ ] **Step 4: Update the modal submit handler — bug/feature path**

In `handleModalSubmit` (~line 1113):

Before:
```ts
        await interaction.editReply(`✅ Issue created: ${issue.html_url}`);
```

After:
```ts
        const dmSent = await notifyReporterOfIssue(interaction.user, issue);
        const dmHint = dmSent ? '' : '\n(Enable DMs to get notified when this is resolved)';
        await interaction.editReply(`✅ Issue created: ${issue.html_url}${dmHint}`);
```

- [ ] **Step 5: Update the modal submit handler — badgroup path**

In `handleModalSubmit` (~line 1143):

Before:
```ts
        await interaction.editReply(`✅ Bad group reported: ${issue.html_url}`);
```

After:
```ts
        const dmSent = await notifyReporterOfIssue(interaction.user, issue);
        const dmHint = dmSent ? '' : '\n(Enable DMs to get notified when this is resolved)';
        await interaction.editReply(`✅ Bad group reported: ${issue.html_url}${dmHint}`);
```

- [ ] **Step 6: Run the full bot test suite**

Run: `npm -w packages/bot run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/bot/src/main.ts
git commit -m "feat: DM reporter and store Firestore tracking on issue creation"
```

---

### Task 4: GitHub Webhook Cloud Function

A new HTTPS Cloud Function that receives GitHub `issues.closed` webhooks, looks up the reporter in Firestore, DMs them via the Discord REST API, and deletes the tracking document.

**Files:**
- Create: `packages/functions/src/githubWebhook.ts`
- Create: `packages/functions/tests/githubWebhook.test.ts`
- Modify: `packages/functions/src/index.ts`

- [ ] **Step 1: Write the webhook signature verification tests**

```ts
// packages/functions/tests/githubWebhook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyGithubSignature } from '../src/githubWebhook';

describe('verifyGithubSignature', () => {
  it('returns true for a valid signature', () => {
    const body = '{"action":"closed"}';
    const secret = 'test-secret';
    // Compute expected HMAC
    const crypto = require('node:crypto');
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

    expect(verifyGithubSignature(body, expected, secret)).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    expect(verifyGithubSignature('body', 'sha256=invalid', 'secret')).toBe(false);
  });

  it('returns false for a missing signature', () => {
    expect(verifyGithubSignature('body', '', 'secret')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm -w packages/functions run test -- --run githubWebhook`
Expected: FAIL — module not found

- [ ] **Step 3: Write the signature verification function**

```ts
// packages/functions/src/githubWebhook.ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';

const discordBotToken = defineSecret('BOT_TOKEN');
const githubWebhookSecret = defineSecret('GITHUB_WEBHOOK_SECRET');

export function verifyGithubSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run signature tests to verify they pass**

Run: `npm -w packages/functions run test -- --run githubWebhook`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/functions/src/githubWebhook.ts packages/functions/tests/githubWebhook.test.ts
git commit -m "feat: add GitHub webhook signature verification"
```

- [ ] **Step 6: Write tests for the Discord DM helper**

Add to `packages/functions/tests/githubWebhook.test.ts`:

```ts
import { sendDiscordDm } from '../src/githubWebhook';

describe('sendDiscordDm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a DM channel and sends a message', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'dm-channel-123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'msg-1' }),
      });

    await sendDiscordDm('bot-token', '123456789', 'Hello!');

    const calls = vi.mocked(global.fetch).mock.calls;
    // First call: open DM channel
    expect(calls[0][0]).toBe('https://discord.com/api/v10/users/@me/channels');
    expect(JSON.parse(calls[0][1]!.body as string)).toEqual({ recipient_id: '123456789' });
    // Second call: send message
    expect(calls[1][0]).toBe('https://discord.com/api/v10/channels/dm-channel-123/messages');
    expect(JSON.parse(calls[1][1]!.body as string)).toEqual({ content: 'Hello!' });
  });

  it('throws if DM channel creation fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'Cannot send messages to this user' }),
    });

    await expect(sendDiscordDm('bot-token', '123456789', 'Hello!')).rejects.toThrow(
      'Failed to open DM channel: 403',
    );
  });
});
```

- [ ] **Step 7: Write the Discord DM helper**

Add to `packages/functions/src/githubWebhook.ts`:

```ts
const DISCORD_API = 'https://discord.com/api/v10';

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
  await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });
}
```

- [ ] **Step 8: Run DM helper tests**

Run: `npm -w packages/functions run test -- --run githubWebhook`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/functions/src/githubWebhook.ts packages/functions/tests/githubWebhook.test.ts
git commit -m "feat: add Discord DM helper for Cloud Functions"
```

- [ ] **Step 10: Write the webhook handler test**

Add to `packages/functions/tests/githubWebhook.test.ts`:

```ts
import { handleIssueWebhook } from '../src/githubWebhook';

// Mock Firestore
const mockDocData = vi.fn();
const mockDocDelete = vi.fn().mockResolvedValue(undefined);
const mockDocGet = vi.fn().mockResolvedValue({
  exists: true,
  data: mockDocData,
});
const mockDoc = vi.fn().mockReturnValue({
  get: mockDocGet,
  delete: mockDocDelete,
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: () => ({ doc: mockDoc }) }),
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

describe('handleIssueWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'dm-ch' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'msg' }) });
  });

  it('sends DM and deletes tracking on issues.closed', async () => {
    mockDocData.mockReturnValue({
      discordUserId: '999',
      issueUrl: 'https://github.com/owner/repo/issues/42',
      issueTitle: 'Fix the thing',
    });

    const result = await handleIssueWebhook(
      { action: 'closed', issue: { number: 42 } },
      'bot-token',
    );

    expect(result).toBe('notified');
    expect(mockDoc).toHaveBeenCalledWith('42');
    expect(mockDocDelete).toHaveBeenCalled();

    const dmCall = vi.mocked(global.fetch).mock.calls[1];
    const body = JSON.parse(dmCall[1]!.body as string);
    expect(body.content).toContain('Fix the thing');
    expect(body.content).toContain('resolved');
  });

  it('returns "ignored" for non-closed actions', async () => {
    const result = await handleIssueWebhook(
      { action: 'opened', issue: { number: 1 } },
      'bot-token',
    );
    expect(result).toBe('ignored');
  });

  it('returns "no-tracking" if no Firestore doc exists', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });

    const result = await handleIssueWebhook(
      { action: 'closed', issue: { number: 99 } },
      'bot-token',
    );
    expect(result).toBe('no-tracking');
  });
});
```

- [ ] **Step 11: Write the webhook handler**

Add to `packages/functions/src/githubWebhook.ts`:

```ts
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
    // DM failed (user may have DMs disabled) — still clean up
    console.warn(`Failed to DM user ${data.discordUserId}: ${e}`);
  }

  await docRef.delete();
  return 'notified';
}
```

- [ ] **Step 12: Run all webhook tests**

Run: `npm -w packages/functions run test -- --run githubWebhook`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add packages/functions/src/githubWebhook.ts packages/functions/tests/githubWebhook.test.ts
git commit -m "feat: add webhook handler for issue close notifications"
```

- [ ] **Step 14: Write the Cloud Function export that wires signature verification to the handler**

Add to `packages/functions/src/githubWebhook.ts`:

```ts
export const onGithubIssueWebhook = onRequest(
  { secrets: [discordBotToken, githubWebhookSecret] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-hub-signature-256'] as string;

    if (!verifyGithubSignature(rawBody, signature, githubWebhookSecret.value())) {
      res.status(401).send('Invalid signature');
      return;
    }

    const payload = req.body as WebhookPayload;
    const result = await handleIssueWebhook(payload, discordBotToken.value());

    res.status(200).json({ result });
  },
);
```

- [ ] **Step 15: Export from the functions index**

In `packages/functions/src/index.ts`, add:

```ts
export { onGithubIssueWebhook } from './githubWebhook.js';
```

- [ ] **Step 16: Run the full functions test suite and typecheck**

Run: `npm -w packages/functions run test && npm -w packages/functions run typecheck`
Expected: PASS

- [ ] **Step 17: Commit**

```bash
git add packages/functions/src/githubWebhook.ts packages/functions/src/index.ts packages/functions/tests/githubWebhook.test.ts
git commit -m "feat: export onGithubIssueWebhook Cloud Function"
```

---

### Task 5: Verification

Run full verification to make sure nothing is broken.

**Files:** None (verification only)

- [ ] **Step 1: Run bot verify script**

Run: `./scripts/verify-ts.sh`
Expected: PASS — lint, typecheck, and all tests pass

- [ ] **Step 2: Run functions typecheck and tests**

Run: `npm -w packages/functions run typecheck && npm -w packages/functions run test`
Expected: PASS

- [ ] **Step 3: Commit any fixes if needed**

---

### Task 6: Manual Setup Steps (Post-Deploy)

These are one-time configuration steps done after deploying. Not automated.

- [ ] **Step 1: Add `GITHUB_WEBHOOK_SECRET` to Doppler**

Generate a random secret and add it as `GITHUB_WEBHOOK_SECRET` in Doppler for the functions environment.

- [ ] **Step 2: Make `BOT_TOKEN` available to Cloud Functions**

Ensure `BOT_TOKEN` is set as a Firebase secret (from Doppler) so the Cloud Function can access it at runtime:

```bash
firebase functions:secrets:set BOT_TOKEN
firebase functions:secrets:set GITHUB_WEBHOOK_SECRET
```

- [ ] **Step 3: Deploy the Cloud Function**

```bash
npm -w packages/functions run deploy
```

Note the deployed function URL (e.g., `https://us-central1-<project>.cloudfunctions.net/onGithubIssueWebhook`).

- [ ] **Step 4: Configure the GitHub webhook**

Go to https://github.com/TytaniumDev/MythicPlusDiscordBot/settings/hooks and add:

- **Payload URL:** the deployed Cloud Function URL
- **Content type:** `application/json`
- **Secret:** the value from `GITHUB_WEBHOOK_SECRET` in Doppler
- **Events:** select only **Issues**

- [ ] **Step 5: Test end-to-end**

1. Run `/bug text:test notification` in Discord
2. Verify you receive a DM with the issue link
3. Close the created issue on GitHub
4. Verify you receive a DM saying the issue is resolved
5. Verify the `issueTracking` doc is deleted in Firestore
6. Delete the test issue
