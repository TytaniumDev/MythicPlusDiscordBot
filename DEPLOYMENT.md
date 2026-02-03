# Deployment Guide for MythicPlusDiscordBot

This guide explains how to run the bot on a Raspberry Pi with Docker and how to automate deployments with GitHub Actions.

## 1. Raspberry Pi Setup (one-time)

The easiest way to run the bot is using Docker, which handles all dependencies including `ffmpeg` and `PyNaCl`.

1.  **Install Docker and Docker Compose** on your Raspberry Pi if you haven't already.
2.  **Clone the repository** to your Pi (recommended path: `~/mythic-plus-bot`).
3.  **Configure Environment Variables**:
    You have two main options for managing secrets:

    ### Option A: Use Host Environment Variables (Recommended)
    You can set the environment variables directly in your shell or your user's profile (`~/.bashrc` or `~/.profile`):
    ```bash
    export BOT_TOKEN=your_discord_bot_token
    export DISCORD_APPLICATION_ID=your_discord_application_id
    ```
    Docker Compose will automatically pick these up from your environment.

    ### Option B: Use a `.env` file
    Create a `.env` file in the root directory:
    ```env
    BOT_TOKEN=your_discord_bot_token
    DISCORD_APPLICATION_ID=your_discord_application_id
    ```

4.  **Data persistence**:
    The default `docker-compose.yml` stores `player_preferences.json` in a named volume mounted at `/data`.
    If you want to customize the location, set `PREFERENCES_PATH` or `DATA_DIR`.

## 2. GitHub Secrets for CI/CD

The workflow in `.github/workflows/ci-cd.yml` builds the Docker image, pushes it to GitHub Container Registry (GHCR), then SSHs into the Pi to pull and restart the container.

**Required secrets**:
- `PI_HOST`: IP or hostname of the Pi.
- `PI_USER`: SSH username.
- `PI_SSH_KEY`: private key for SSH access.
- `PI_APP_DIR`: path to the repo on the Pi (e.g., `/home/pi/mythic-plus-bot`).
- `GHCR_TOKEN`: GitHub PAT with `read:packages` scope (used by the Pi to pull the image).

**Optional secrets**:
- `PI_SSH_PORT`: SSH port (defaults to 22).
- `BOT_TOKEN` / `DISCORD_APPLICATION_ID`: only needed if you want to inject secrets from GitHub instead of keeping them on the Pi.

## 3. How the GitHub Actions workflow works

1. Runs unit tests.
2. Builds a multi-arch Docker image (amd64 + arm64) and pushes it to GHCR.
3. SSHs to the Pi and runs `docker compose pull` followed by `docker compose up -d`.

The deploy step exports `IMAGE_NAME` and `IMAGE_TAG` for `docker-compose.yml` so the Pi always pulls the exact build that passed CI.

## 4. Manual deploy/update (if needed)

On the Pi:
```bash
cd ~/mythic-plus-bot
export IMAGE_NAME=ghcr.io/<owner>/<repo>
export IMAGE_TAG=latest
docker compose pull
docker compose up -d --remove-orphans
```

## 5. Discord Developer Portal (for Activities)

To enable the `!activity` command, you need to configure your bot as a Discord Activity.

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Select your Application.
3.  Go to **Activities** -> **Getting Started**.
4.  Set up the **URL Mapping**:
    - Set the origin to your GitHub Pages URL (see below).
5.  Note your **Application ID** and ensure it's in the `.env` file as `DISCORD_APPLICATION_ID`.

## 6. Hosting the Activity (GitHub Pages)

The Discord Activity is a static web app located in the `activity/` folder.

1.  Create a new repository on GitHub.
2.  Upload the contents of the `activity/` folder (`index.html`, `style.css`, `script.js`) to the repository.
3.  Enable **GitHub Pages** in the repository settings (Settings -> Pages).
4.  Once deployed, you will get a URL like `https://yourusername.github.io/your-repo/`.
5.  Use this URL in the Discord Developer Portal for URL Mapping.

## 7. Bot Commands

- `!wheel`: The classic text-based reveal.
- `!newwheel`: Enhanced UI with Voice Channel integration, sound effects, and a spinning wheel GIF.
- `!activity`: Everything in `!newwheel` plus an invite to join the Discord Activity for a synchronized wheel experience.

## 8. Troubleshooting

- **Audio not working**: Ensure the bot has "Connect" and "Speak" permissions in the voice channel.
- **Activity not starting**: Ensure the `DISCORD_APPLICATION_ID` is correct and the URL mapping in the Discord Developer Portal is properly configured.
- **Docker issues**: Check logs with `docker compose logs -f`.
- **Manual Asset Setup**: If you are not using Docker, you can run `python3 setup_assets.py` manually to prepare the sounds and GIF.
