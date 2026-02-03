# MythicPlusDiscordBot
Handles Mythic+ groups for everyone in our guild.

This repo is deployed using Docker images and GitHub Actions CI/CD to a Raspberry Pi over Tailscale.
Secrets are injected by GitHub Actions at deploy time, so there is no `.env` file on the Pi.

## Quick start (CI/CD)
1. Follow the Raspberry Pi bootstrap steps in `DEPLOYMENT.md`.
2. Add the required GitHub Secrets (listed below).
3. Push to `main`/`master` to trigger deployment.

## Required GitHub Secrets
- `TS_AUTHKEY`: Tailscale auth key (reusable + ephemeral recommended).
- `PI_HOST`: Tailscale hostname or IP (example: `pi.asdflasjd.ts.net`).
- `PI_USER`: SSH user on the Pi (example: `pi` or `deploy`).
- `PI_SSH_KEY`: Private SSH key contents for CI access.
- `PI_APP_DIR`: Repo path on the Pi (example: `/home/pi/mythic-plus-bot`).
- `GHCR_TOKEN`: GitHub PAT with `read:packages` (classic if fine-grained lacks Packages).
- `BOT_TOKEN`: Discord bot token.
- `DISCORD_APPLICATION_ID`: Discord app ID.

## Optional GitHub Secrets
- `PI_SSH_PORT`: Defaults to 22 if omitted.
- `DEPLOY_WEBHOOK_URL`: Discord webhook for deploy notifications.

## What the pipeline does
1. Runs tests.
2. Builds and pushes a multi-arch Docker image to GHCR.
3. Connects to the Pi via Tailscale and runs `docker compose pull` + `up`.
4. Verifies container health and restarts once if unhealthy.

See `DEPLOYMENT.md` for detailed Raspberry Pi setup steps.
