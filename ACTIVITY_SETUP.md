# Discord Activity Setup Guide

This guide details how to set up the "Wheel of Names" activity for your Discord bot. This involves hosting the web files on GitHub Pages and configuring your Discord Application to recognize them.

## 1. Hosting the Activity (GitHub Pages)

We have added a GitHub Action to automatically deploy your activity files. You just need to enable it.

1.  Go to your repository on GitHub.
2.  Click on the **Settings** tab.
3.  In the left sidebar, click on **Pages** (under the "Code and automation" section).
4.  Under **Build and deployment**:
    *   **Source**: Select **GitHub Actions**.
5.  Once saved, the `Deploy Activity to Pages` workflow should run automatically on the next push.
    *   *To trigger it manually now:* Go to the **Actions** tab, select "Deploy Activity to Pages", and click "Run workflow".
6.  After the workflow finishes, you will see your **site URL** in the Pages settings (usually `https://<user>.github.io/<repo>/`). **Copy this URL.**

## 2. Discord Developer Portal Configuration

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Select your application.
3.  Copy the **Application ID** from the **General Information** page.
    *   Ensure this ID is set as `DISCORD_APPLICATION_ID` in your bot's `.env` file or environment variables.

### Configure the Activity

1.  In the left sidebar, look for **Activities**.
    *   *Note: If you don't see an Activities tab, you may need to look for "Embedded App SDK" or ensure you are looking at the main application settings.*
2.  Locate the **URL Mappings** section.
3.  Add a new mapping:
    *   **Prefix**: `/`
    *   **Target**: Paste the GitHub Pages URL you copied earlier (e.g., `https://yourname.github.io/your-repo/`).
    *   *Important:* Ensure the target URL matches exactly.

## 3. Running the Activity

1.  Start your bot.
2.  Join a Voice Channel in Discord.
3.  Run the command: `/activity` (or `!activity` if using prefixes).
4.  The bot should reply with a "Join Activity" link.
5.  Clicking the link will open your hosted Wheel of Names directly inside Discord!

## Troubleshooting

*   **"404 Not Found" in the Activity:** Check your GitHub Pages URL in the Developer Portal. It must match exactly where your `index.html` is hosted.
*   **Bot says "Application ID not available":** You forgot to set `DISCORD_APPLICATION_ID` in your environment variables.
*   **Activity doesn't load:** Open the Discord Console (Ctrl+Shift+I) to check for errors (like CORS or CSP issues, though GitHub Pages is usually fine).
