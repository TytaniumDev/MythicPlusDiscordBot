# Deployment Guide

Everything runs on managed services: Firebase (Firestore, Cloud Functions, Authentication), GitHub Pages (the activity) and Discord (application commands). There is no server to run. A merge to `main` deploys all of it through `.github/workflows/deploy.yml`.

## 1. What a deploy does

The `Deploy` workflow runs CI once against the merged commit (`ci-shared.yml`), then:

| Job | Deploys |
|-----|---------|
| `deploy-firebase` | `firestore.rules`, `firestore.indexes.json` (including the TTL policies) and every Cloud Function in `packages/functions` |
| `register-commands` | Discord's global application commands: `/bug`, `/featurerequest` and the activity's Entry Point command (`packages/functions/src/applicationCommands.ts`) |
| `deploy-pages` | The activity build and Storybook to GitHub Pages |

Deploys run one at a time in merge order. Running the workflow by hand from any branch but `main` deploys nothing.

## 2. Secrets for CI/CD

The deploy workflow reads its secrets from Doppler. The only GitHub Actions secret it needs is `DOPPLER_TOKEN` (repo → Settings → Secrets and variables → Actions), a Doppler service token for the production config.

Set these in Doppler:

- `FIREBASE_CREDENTIALS_JSON`: Firebase service-account JSON, used to deploy rules and functions.
- `BOT_TOKEN`: Discord bot token, used to register the commands.
- `DISCORD_APPLICATION_ID`: Discord application ID (Application → General Information). Also the activity's `VITE_DISCORD_CLIENT_ID`.
- `VITE_FIREBASE_*`, `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`: activity build settings for the Pages deploy.

Cloud Functions read their own credentials from Google Secret Manager instead (`BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `GITHUB_ISSUES_TOKEN` and others). See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) section 7.

## 3. Discord Developer Portal

Configure the application in the [Discord Developer Portal](https://discord.com/developers/applications).

### 3.1 Interactions Endpoint URL (General Information)

Set it to the `discordInteractions` Cloud Function:

```
https://us-central1-mythicplusdiscordbot.cloudfunctions.net/discordInteractions
```

Discord sends a signed test request when you save, and refuses the URL if the function doesn't answer it, so a typo can't break anything. Every slash command and form submission then goes to the function.

### 3.2 Bot

Wheelson keeps a bot user in each server, but nothing connects to Discord's gateway. The Cloud Functions use the bot token to read activity instances and server nicknames for the lobby, and to DM players about their reports. No privileged gateway intents are needed.

Invite it with the **bot** and **applications.commands** scopes. It needs no channel permissions: it never posts in channels.

### 3.3 Activity

See [ACTIVITY_SETUP.md](ACTIVITY_SETUP.md) for the Activity and its URL mappings.

## 4. Verification checklist

If a deploy fails or something looks wrong in production:

1. **Actions → Deploy**: check which job failed. A `deploy-firebase` failure that names a secret usually means a Secret Manager secret is missing or its access isn't set up (FIREBASE_SETUP.md section 7).
2. **Commands**: `register-commands` logs the names it registered. Discord can take a few minutes to show a change in the command picker.
3. **Function logs**: for the lobby roster or reports, read the function's logs:
   ```bash
   npx firebase-tools@14 functions:log --only syncLobbyMembers --project mythicplusdiscordbot
   ```
   The `firebase-debug` skill (`.claude/skills/firebase-debug/`) covers reading Firestore and logs in more depth.
