# Firebase Setup Instructions

This project uses Firebase Firestore to synchronize the Discord Bot (Backend) and the Web Frontend.

## 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click "Add project" and follow the prompts.
3. Once created, go to **Project Settings** (gear icon).

## 2. Frontend Configuration (GitHub Secrets)
The frontend needs public configuration to connect to Firebase.

1. In Firebase Console > Project Settings > General, scroll down to "Your apps".
2. Click the Web icon (</>) to create a new web app.
3. Copy the configuration values (apiKey, authDomain, etc.).
4. Go to your GitHub Repository -> Settings -> Secrets and variables -> Actions.
5. Add the following Repository Secrets:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

## 3. Backend Configuration (Service Account)
The bot needs a Service Account to write to Firestore with admin privileges.

1. In Firebase Console > Project Settings > **Service accounts**.
2. Click "Generate new private key".
3. This will download a `.json` file containing your credentials.
3. **Minify** this JSON (optional but recommended for readability). You can use an online tool or `jq -c . file.json`.
4. Add the JSON content as a GitHub Secret named `FIREBASE_CREDENTIALS_JSON`. The deployment pipeline handles both minified and multiline JSON safely. For local development, add it to your `.env` file:
   ```env
   FIREBASE_CREDENTIALS_JSON='{"type": "service_account", ...}'
   ```

## 4. Production Deploy (GitHub Actions)
For the main bot deploy (e.g. to a Raspberry Pi via `.github/workflows/deploy.yml`), set the repository secret `FIREBASE_CREDENTIALS_JSON` in GitHub (Settings → Secrets and variables → Actions). The deploy workflow passes it into the Pi environment so the container can use Firebase. Without this secret, the bot will run but Firebase features (e.g. the `/wheelson` live lobby and Firestore-backed preferences) will be disabled.

## 5. Firestore Database and Rules
1. Go to **Firestore Database** in the left sidebar.
2. Click "Create Database".
3. Choose **Standard** edition and select a location (e.g. your nearest region).
4. After the database is created, open the **Rules** tab.
5. The canonical security rules for this project live in [`firestore.rules`](firestore.rules) at the repo root. Copy that file into the Rules tab in the Firebase Console (or deploy via `firebase deploy --only firestore:rules`). It covers all collections used at runtime:

   Reads are public. Every client write requires the anonymous Firebase sign-in the activity does on load, and may only touch the fields the activity actually writes (with type and size checks). The bot and Cloud Functions use the Admin SDK, which bypasses the rules.

   - `guilds/{guildId}` — clients can set up a guild doc and record `groupHistory` / `seasonPairs` / `refreshRequest`; `guildName`, `guildIconUrl` and `voiceChannels` are bot-owned. No delete.
   - `channels/{channelId}` — clients create a lobby (status `lobby`, parent guild must exist) and drive the round. Status moves `lobby` → `spinning` → `completed`, and anything can reset to `lobby`. `groups` can only be written when a spin starts or cleared on reset, so a second Spin can't overwrite a round in progress. `players` is bot-owned (clients may only start it empty). No delete.
   - `preferences/{discordId}` — doc ID must be a numeric Discord ID; roles must be known role names, `mediaUrl` must be a `render.worldofwarcraft.com` URL, `characterClass` a known class. No delete.
   - `config/{docId}` — public read; writes are server-only (Cloud Functions populate `config/affixes` and `config/season`).
   - `rateLimits/{docId}` — server-only (read and write deny).
   - `characters/{region}/{realm}/{name}` — server-only; reads/writes go through the `lookupCharacter` Cloud Function.
   - `badGroupReports/{docId}` — clients can `create` a report with the exact report shape, for a guild that exists; read/update/delete are server-only. The bot listens server-side and files GitHub issues.
   - `issueTracking/{issueNumber}` — implicitly server-only (no rule grants client access); written by the bot and consumed by the GitHub close webhook Cloud Function.

   The rules are tested against the emulator in `activity/rules/firestore.rules.test.ts` (run by `./scripts/emulator-test.sh`): every write the activity makes must stay allowed, and the tampering cases must stay rejected.

   If you need to deviate from the canonical rules, treat `firestore.rules` as the source of truth and keep your Console copy in sync.

## 6. Document cleanup (database growth)

Channel documents are ephemeral lobbies and are cleaned up; guild documents are durable and never deleted:

- **Guild docs persist.** `guilds/{guildId}` is one small doc per server holding `groupHistory` and `seasonPairs`. Group history resets itself each day at midnight Pacific (it is stamped with `todayPST()` and ignored on any other date), and season pair counts reset when `config/season` changes.
- **Completion does not trigger cleanup.** When the frontend sets `status: 'completed'`, the channel doc stays so results remain visible.
- **Empty lobby.** When the last person leaves a tracked voice channel, the bot deletes its channel doc.
- **New lobby replaces the previous one.** When someone runs `/wheelson` again in the same voice channel, the bot resets the existing channel document back to `status: 'lobby'` (clearing `groups`) so the Activity link continues to work.
- **Startup cleanup.** On **bot startup**, the bot deletes any channel document whose `lastActive` is older than **24 hours**.

## 7. Cloud Functions secrets

Cloud Functions read their credentials from Google Secret Manager (`defineSecret` in `packages/functions/src`), not from environment variables. The deploy fails if a secret a function declares doesn't exist, so create every secret before the first deploy that uses it.

| Secret | Used by |
|--------|---------|
| `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET` | `lookupCharacter`, `refreshCharacterMedia` (Battle.net API client from https://develop.battle.net) |
| `BOT_TOKEN`, `GITHUB_WEBHOOK_SECRET` | `onGithubIssueWebhook` |

The production values are in Doppler. To create or rotate one, run this from the repo root, logged in to both the Doppler CLI and `firebase-tools` with an account that has Secret Manager access on the project. The value goes straight from Doppler to Secret Manager and never lands in your shell history:

```bash
doppler secrets get BNET_CLIENT_ID --plain \
  | npx firebase-tools@14 functions:secrets:set BNET_CLIENT_ID --data-file=- --project mythicplusdiscordbot
```

Functions bind the latest secret version when they deploy, so after a rotation, redeploy (re-run the Deploy workflow) to pick up the new value.

The deploy service account (`FIREBASE_CREDENTIALS_JSON`) needs to read each secret and to grant the functions' runtime service account `roles/secretmanager.secretAccessor` on it. `roles/secretmanager.admin` covers both. If you'd rather not give it that role, grant the accessor binding yourself; the deploy only checks for it:

```bash
gcloud secrets add-iam-policy-binding BNET_CLIENT_ID --project mythicplusdiscordbot \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

`gcloud secrets get-iam-policy BOT_TOKEN --project mythicplusdiscordbot` shows the bindings an already-working secret has, so you can mirror them.
