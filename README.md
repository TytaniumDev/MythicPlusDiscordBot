# MythicPlusDiscordBot
Handles Mythic+ groups for everyone in our guild.

## Docker quick start

1. Create a `.env` file with your Discord secrets:
   ```env
   BOT_TOKEN=your_discord_bot_token
   DISCORD_APPLICATION_ID=your_discord_application_id
   ```
2. Build and run:
   ```bash
   docker compose up -d --build
   ```

## CI/CD deployment

This repo includes a GitHub Actions workflow that builds a Docker image, pushes it to GHCR, and deploys it to a Raspberry Pi via SSH. See `DEPLOYMENT.md` for setup and required secrets.