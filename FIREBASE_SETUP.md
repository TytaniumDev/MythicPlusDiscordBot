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

   - `guilds/{guildId}` — public read, create, update; no delete. `guildId` field is immutable.
   - `channels/{channelId}` — public read, create (only with status `lobby` and a real parent guild), update (status restricted to `lobby` / `spinning` / `completed`); no delete. The bot's Admin SDK bypasses these rules and handles deletes/cleanup.
   - `preferences/{docId}` — public read, create, update; no delete.
   - `config/{docId}` — public read; writes are server-only (Cloud Functions populate `config/affixes` and `config/season`).
   - `rateLimits/{docId}` — server-only (read and write deny).
   - `characters/{region}/{realm}/{name}` — server-only; reads/writes go through the `lookupCharacter` Cloud Function.
   - `badGroupReports/{docId}` — clients can `create` only (and the doc must reference a real guild via `guildId`); read/update/delete are server-only. The bot listens server-side and files GitHub issues.
   - `issueTracking/{issueNumber}` — implicitly server-only (no rule grants client access); written by the bot and consumed by the GitHub close webhook Cloud Function.

   If you need to deviate from the canonical rules, treat `firestore.rules` as the source of truth and keep your Console copy in sync.

## 6. Document cleanup (database growth)

Guild and channel documents are cleaned up so the database does not grow indefinitely:

- **Completion does not trigger cleanup.** When the frontend sets `status: 'completed'`, the bot only announces results to Discord. The documents stay active so the web page remains valid (e.g. you can keep viewing results).
- **New lobby replaces the previous one.** When someone runs `/wheelson` again in the same voice channel, the bot resets the existing channel document back to `status: 'lobby'` (clearing `groups`) so the Activity link continues to work.
- **Startup cleanup.** On **bot startup**, the bot deletes any channel document whose `lastActive` is older than **24 hours**.
