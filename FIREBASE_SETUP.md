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
5. The canonical security rules for this project live in [`firestore.rules`](firestore.rules) at the repo root. Copy that file into the Rules tab in the Firebase Console (or deploy via `firebase deploy --only firestore:rules,firestore:indexes`; `deploy.yml` does this on every merge to `main`). It covers all collections used at runtime:

   Reads are public. Every client write requires the anonymous Firebase sign-in the activity does on load, and may only touch the fields the activity actually writes (with type and size checks). The bot and Cloud Functions use the Admin SDK, which bypasses the rules.

   - `guilds/{guildId}` — clients can set up a guild doc and record `groupHistory` / `seasonPairs` / `refreshRequest`; `guildName`, `guildIconUrl` and `voiceChannels` are bot-owned. No delete.
   - `channels/{channelId}` — clients create a lobby (status `lobby`, parent guild must exist) and drive the round. Status moves `lobby` → `spinning` → `completed`, and anything can reset to `lobby`. `groups` can only be written when a spin starts or cleared on reset, so a second Spin can't overwrite a round in progress. `members` (who is in voice) and `expireAt` (the TTL expiry) are bot-only: clients can't write them at all, so a lobby a client opens stays empty until the bot fills it in. No delete.
   - `preferences/{discordId}` — each player's profile, and its only copy. Doc ID must be a numeric Discord ID; roles must be known role names, `mediaUrl` must be a `render.worldofwarcraft.com` URL, `characterClass` a known class. No delete.
   - `config/{docId}` — public read; writes are server-only (Cloud Functions populate `config/affixes` and `config/season`).
   - `rateLimits/{docId}` — server-only (read and write deny).
   - `characterCache/{region}:{realm}:{name}` — server-only; the Battle.net lookup cache written by the `lookupCharacter` and `refreshCharacterMedia` Cloud Functions.
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
- **TTL policies.** Firestore deletes docs whose `expireAt` has passed (usually within a day of it). The policies are code in the `fieldOverrides` of [`firestore.indexes.json`](firestore.indexes.json), applied by `firebase deploy --only firestore:indexes`:
  - `channels.expireAt` — the bot sets it to 24 hours after its latest write to the lobby (creating it, or rewriting `members` on a voice change or at bot startup), so an abandoned lobby goes away a day after the bot last saw activity.
  - `rateLimits.expireAt` — the end of the doc's rate-limit window.
  - `characterCache.expireAt` — 30 days after the entry was last refreshed.

  Guild docs have no `expireAt` and never expire. Managing TTL policies needs `roles/datastore.indexAdmin` (or Owner) on the deploy service account. To set them up without a deploy:

  ```bash
  gcloud firestore fields ttls update expireAt --collection-group=channels --enable-ttl --project=<project-id>
  gcloud firestore fields ttls update expireAt --collection-group=rateLimits --enable-ttl --project=<project-id>
  gcloud firestore fields ttls update expireAt --collection-group=characterCache --enable-ttl --project=<project-id>
  ```

## 7. Cloud Functions secrets

Cloud Functions read their credentials from Google Secret Manager (`defineSecret` in `packages/functions/src`), not from environment variables. The deploy fails if a secret a function declares doesn't exist, so create every secret before the first deploy that uses it.

| Secret | Used by |
|--------|---------|
| `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET` | `lookupCharacter`, `refreshCharacterMedia` (Battle.net API client from https://develop.battle.net) |
| `BOT_TOKEN`, `GITHUB_WEBHOOK_SECRET` | `onGithubIssueWebhook` |
| `DISCORD_APPLICATION_ID`, `DISCORD_CLIENT_SECRET` | `discordSignIn` (the application ID and OAuth2 client secret from the Discord Developer Portal's **OAuth2** page) |

The production values are in Doppler. To create or rotate one, run this from the repo root, logged in to both the Doppler CLI and `firebase-tools` with an account that has Secret Manager access on the project. The value goes straight from Doppler to Secret Manager and never lands in your shell history:

```bash
printf %s "$(doppler secrets get BNET_CLIENT_ID --plain)" \
  | npx firebase-tools@14 functions:secrets:set BNET_CLIENT_ID --data-file=- --project mythicplusdiscordbot
```

`doppler secrets get --plain` ends its output with a newline, and piping it straight in stores that newline in the secret (which made Battle.net OAuth return 401); `printf %s "$(...)"` strips it.

Functions bind the latest secret version when they deploy, so after a rotation, redeploy (re-run the Deploy workflow) to pick up the new value.

Two service accounts need access to every secret:

- **The deploy service account** (`FIREBASE_CREDENTIALS_JSON`) reads each secret during `firebase deploy` and makes sure the runtime account can read it. In this project it has access **one secret at a time**, not project-wide, so a new secret starts with none. The deploy then stops with `Permission 'secretmanager.secrets.get' denied on resource ... (or it may not exist)`.
- **The functions' runtime service account** (`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`) reads the value while running. The deploy grants it `roles/secretmanager.secretAccessor` once the deploy account has access.

After creating a secret, copy the access of one that already deploys (`BNET_CLIENT_ID`) onto it. Paste this into [Cloud Shell](https://shell.cloud.google.com) or any shell with `gcloud` logged in as a project Owner, with the new secret names in `NEW_SECRETS`. It's safe to re-run:

```bash
bash <<'EOF'
set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
PROJECT=mythicplusdiscordbot
SOURCE=BNET_CLIENT_ID
NEW_SECRETS="DISCORD_APPLICATION_ID DISCORD_CLIENT_SECRET"

BINDINGS=$(gcloud secrets get-iam-policy "$SOURCE" --project "$PROJECT" \
  --flatten="bindings[].members" --format="value(bindings.role,bindings.members)")
[ -n "$BINDINGS" ] || { echo "No access set on $SOURCE"; exit 1; }

for SECRET in $NEW_SECRETS; do
  while read -r ROLE MEMBER; do
    [ -z "$ROLE" ] && continue
    gcloud secrets add-iam-policy-binding "$SECRET" --project "$PROJECT" \
      --member="$MEMBER" --role="$ROLE" --condition=None </dev/null >/dev/null
    echo "$SECRET: $ROLE for $MEMBER"
  done <<< "$BINDINGS"
done
EOF
```

If a deploy has already failed on the missing access, re-run its failed `deploy-firebase` job afterwards. No new commit is needed.

### Custom tokens (`discordSignIn`)

`discordSignIn` mints Firebase custom tokens with `createCustomToken`, which signs them with the functions' runtime service account. That account needs permission to sign as itself, and the IAM Service Account Credentials API must be enabled; without them the callable fails with `auth/insufficient-permission`:

```bash
gcloud services enable iamcredentials.googleapis.com --project mythicplusdiscordbot
gcloud iam service-accounts add-iam-policy-binding <PROJECT_NUMBER>-compute@developer.gserviceaccount.com \
  --project mythicplusdiscordbot \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

Custom-token sign-in needs no provider switched on in Firebase Authentication.
