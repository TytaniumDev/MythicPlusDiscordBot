# Discord Activity Setup Guide

This guide details how to set up the Wheelson activity for your Discord application. This involves hosting the web files on GitHub Pages and configuring your Discord Application to recognize them.

## 1. Hosting the Activity (GitHub Pages)

We have added a GitHub Action to automatically deploy your activity files. You just need to enable it.

1.  Go to your repository on GitHub.
2.  Click on the **Settings** tab.
3.  In the left sidebar, click on **Pages** (under the "Code and automation" section).
4.  Under **Build and deployment**:
    *   **Source**: Select **GitHub Actions**.
5.  Once saved, the `Deploy` workflow publishes the activity on the next push to `main`.
    *   *To trigger it manually now:* Go to the **Actions** tab, select "Deploy", and click "Run workflow" on `main`.
6.  After the workflow finishes, you will see your **site URL** in the Pages settings (usually `https://<user>.github.io/<repo>/`). **Copy this URL.**

## 2. Discord Developer Portal Configuration

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Select your application.
3.  Copy the **Application ID** from the **General Information** page.
    *   Store it in Doppler as `DISCORD_APPLICATION_ID` (the deploy builds the activity with it) and in Secret Manager under the same name ([FIREBASE_SETUP.md](FIREBASE_SETUP.md) section 7).

### Configure the Activity

1.  In the left sidebar, look for **Activities**.
    *   *Note: If you don't see an Activities tab, you may need to look for "Embedded App SDK" or ensure you are looking at the main application settings.*
2.  Locate the **URL Mappings** section.
3.  Add a new mapping:
    *   **Prefix**: `/`
    *   **Target**: Paste the GitHub Pages URL you copied earlier (e.g., `https://yourname.github.io/your-repo/`).
    *   *Important:* Ensure the target URL matches exactly.
4.  Add the mappings for the services the activity calls. Inside Discord it can only reach hosts listed here (`activity/src/discordSdk.ts` and `activity/src/lib/sentry.ts` rewrite requests to these prefixes):

    | Prefix | Target |
    | --- | --- |
    | `/firebase` | `firestore.googleapis.com` |
    | `/auth` | `identitytoolkit.googleapis.com` |
    | `/authtoken` | `securetoken.googleapis.com` |
    | `/functions` | `us-central1-<firebase project ID>.cloudfunctions.net` |
    | `/blizzard-renders` | `render.worldofwarcraft.com` |
    | `/raiderio-cdn` | `cdn.raiderio.net` |
    | `/raiderio` | `raider.io` |
    | `/sentry` | The host in `VITE_SENTRY_DSN`, the part after `@` (like `o123.ingest.us.sentry.io`) |

### Optional: Sign in with Discord

Players can opt in to **Sign in with Discord** inside the activity, so Wheelson knows who they are without the name picker. It needs:

1.  **OAuth2 redirect**: on the **OAuth2** page, add at least one redirect URI. Discord's activity `authorize` flow needs one configured even though the activity never redirects; a placeholder like `https://127.0.0.1` works.
2.  **Client secret**: on the same page, copy (or reset) the **Client Secret** and store it, with the application ID, in Secret Manager as `DISCORD_CLIENT_SECRET` and `DISCORD_APPLICATION_ID` ([FIREBASE_SETUP.md](FIREBASE_SETUP.md) section 7). Create both, and give them the same access as the existing secrets (the copy script in that section), before deploying functions, or the deploy fails.
3.  **Custom tokens**: the IAM setup under "Custom tokens" in [FIREBASE_SETUP.md](FIREBASE_SETUP.md) section 7.

If sign-in fails or a player closes Discord's consent prompt, the activity keeps working as before.

## 2.5 Firebase Configuration

The activity uses Firebase (Firestore + Auth + Functions) for real-time lobby
state and group reveals. Without these credentials the frontend will fail to
initialize.

### Frontend (`activity/`)

The Vite frontend reads the following variables at **build time** (Vite inlines
`import.meta.env.VITE_*` into the bundle), so they must be present whenever the
activity is built, including when the deploy workflow builds it for GitHub
Pages. Store each one in Doppler, where the deploy workflow reads them:

| Variable                            | Source (Firebase Console → Project Settings) |
| ----------------------------------- | -------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Web app config — `apiKey`                    |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Web app config — `authDomain`                |
| `VITE_FIREBASE_PROJECT_ID`          | Web app config — `projectId`                 |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Web app config — `storageBucket`             |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Web app config — `messagingSenderId`         |
| `VITE_FIREBASE_APP_ID`              | Web app config — `appId`                     |

For local development, place the same values in `activity/.env.local`.

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for instructions on provisioning the
Firebase project, enabling Firestore, and generating the web app config.

## 3. Running the Activity

1.  Join a voice channel in Discord.
2.  Open the Activities launcher (the rocket button) and pick Wheelson.
3.  Everyone who opens it in that voice channel shares one lobby.

## Troubleshooting

*   **"404 Not Found" in the Activity:** Check your GitHub Pages URL in the Developer Portal. It must match exactly where your `index.html` is hosted.
*   **The lobby stays empty:** the `syncLobbyMembers` Cloud Function fills it in. Check its logs (DEPLOYMENT.md section 4).
*   **Activity doesn't load:** Open the Discord Console (Ctrl+Shift+I) to check for errors (like CORS or CSP issues, though GitHub Pages is usually fine).
