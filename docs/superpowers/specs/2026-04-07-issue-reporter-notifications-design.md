# Issue Reporter Notifications Design

When a Discord user submits a bug report, feature request, or bad group report through the bot, they should receive a DM with a link to the created GitHub issue and a promise to notify them when it's resolved. When the issue is later closed on GitHub, they receive a follow-up DM.

## Components

### 1. Firestore Mapping — `issueTracking/{issueNumber}`

Each document tracks an open GitHub issue submitted through the bot:

| Field           | Type      | Description                     |
| --------------- | --------- | ------------------------------- |
| `discordUserId` | `string`  | Reporter's Discord snowflake ID |
| `issueUrl`      | `string`  | GitHub issue HTML URL           |
| `issueTitle`    | `string`  | Issue title (for the DM)        |
| `createdAt`     | `Timestamp`| When the issue was created      |

Keyed by GitHub issue number. Created by the bot on issue submission. Deleted by the Cloud Function after sending the close notification.

### 2. Bot Changes (Issue Creation)

After each successful `createGithubIssue` call, two new steps:

1. **Write Firestore mapping** — store the `issueTracking/{issueNumber}` document with the reporter's Discord user ID, issue URL, and title.
2. **DM the reporter** — send a message like:
   > Your bug report has been submitted! You can track it here: https://github.com/...
   > I'll DM you when it's resolved.

This applies to all 5 issue creation paths:

- `/bug` quick text (main.ts ~line 802)
- `/bug` modal submit (main.ts ~line 1113)
- `/featurerequest` quick text (main.ts ~line 872)
- `/featurerequest` modal submit (main.ts ~line 1113)
- `/badgroup` modal submit (main.ts ~line 1143)

The existing ephemeral channel reply is unchanged — the DM is additive.

**DM failure handling:** If the DM fails (user has DMs disabled), log a warning and append a hint to the ephemeral reply: "Enable DMs to get notified when this is resolved." Do not block issue creation.

### 3. Cloud Function — `onGithubIssueWebhook`

A new HTTPS Cloud Function that receives GitHub webhook payloads.

**Flow:**

1. Verify the webhook signature using a shared secret (`GITHUB_WEBHOOK_SECRET` from Doppler).
2. Check the event is `issues` with `action: "closed"`. Ignore all other events.
3. Extract the issue number from the payload.
4. Look up `issueTracking/{issueNumber}` in Firestore.
5. If no document exists, return 200 (issue wasn't created through the bot).
6. Call the Discord REST API to DM the stored `discordUserId`:
   > Your issue "[title]" has been resolved!
   > https://github.com/...
7. Delete the Firestore document (cleanup).

The function calls Discord's REST API directly (`POST /users/@me/channels` to open a DM channel, then `POST /channels/{id}/messages` to send the message) using `BOT_TOKEN` from Doppler. This decouples notifications from the bot process — they work even if the bot is temporarily offline.

**Secrets (stored in Doppler):**

- `BOT_TOKEN` — already exists in Doppler for the bot; must also be made available to Cloud Functions runtime config
- `GITHUB_WEBHOOK_SECRET` — new; shared secret for webhook signature verification, added to Doppler and Cloud Functions runtime config

**GitHub repo configuration:**

- Add a webhook at `https://github.com/TytaniumDev/MythicPlusDiscordBot/settings/hooks`
- URL: the deployed Cloud Function's HTTPS endpoint
- Content type: `application/json`
- Secret: matches `GITHUB_WEBHOOK_SECRET` in Doppler
- Events: subscribe to **Issues** only

## Error Handling & Edge Cases

| Scenario | Behavior |
| --- | --- |
| DM fails at creation time | Log warning, hint in ephemeral reply. Don't block issue creation. |
| DM fails at close time | Log error in Cloud Function. Delete Firestore doc anyway — no retry. |
| Issue reopened then closed again | Mapping already deleted on first close — no second notification. Acceptable. |
| Issue not created through bot | No Firestore doc — webhook is a no-op, returns 200. |
| Invalid webhook signature | Return 401, log the attempt. |
| Issue closed before Firestore write completes | Extremely unlikely given time scales. Not worth engineering around. |

## Testing

### Bot unit tests
- Mock Firestore and Discord DM calls.
- Verify the Firestore mapping is written after issue creation.
- Verify the DM is attempted with the correct content.
- Verify DM failure is handled gracefully (warning logged, hint in ephemeral reply).

### Cloud Function tests
- Mock GitHub webhook payload, Firestore lookup, and Discord API call.
- Verify it sends the correct DM on `issues.closed`.
- Verify it deletes the Firestore document after notifying.
- Verify it handles missing Firestore docs gracefully (returns 200).
- Verify invalid webhook signatures are rejected with 401.

## Files to Create/Modify

### New files
- `packages/functions/src/githubWebhook.ts` — the Cloud Function
- `packages/functions/tests/githubWebhook.test.ts` — Cloud Function tests
- `packages/bot/src/services/issueTrackingService.ts` — Firestore read/write for `issueTracking` collection
- `packages/bot/tests/services/issueTrackingService.test.ts` — service tests

### Modified files
- `packages/functions/src/index.ts` — export the new Cloud Function
- `packages/bot/src/main.ts` — add Firestore write + DM after issue creation in all 5 paths
- `packages/bot/src/core/issues.ts` — optionally refactor to return typed issue data (number, URL, title) instead of raw `Record<string, unknown>`
