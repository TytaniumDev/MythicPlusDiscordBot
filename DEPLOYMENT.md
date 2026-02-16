# Deployment Guide (Docker + Watchtower)

This guide documents the deployment flow for this project:
Docker images are built by GitHub Actions and pushed to GHCR.
The Raspberry Pi runs **Watchtower**, which automatically pulls new images and restarts the bot.

## 1. Raspberry Pi bootstrap (new device)

Run these steps once on a fresh Pi.

### 1.1 Create a deploy user (recommended)
```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```
Use `pi` instead of `deploy` if you prefer.

### 1.2 Install Docker and Compose (v2)
```bash
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker deploy
```
Log out and back in (or run `newgrp docker`) for group changes to apply.

## 2. Configuration

Create a `.env` file in the directory where you will run the bot (e.g., `~/mythic-plus-bot/.env`).
This file will store all secrets and configuration.

```bash
# Discord Bot Token
BOT_TOKEN=your_bot_token_here

# Discord Application ID (for !activity)
DISCORD_APPLICATION_ID=your_app_id_here

# GitHub Container Registry (GHCR) Credentials
# Used by Watchtower to pull updates from the private registry.
# User is your GitHub username. Token is a PAT with `read:packages`.
GHCR_USER=your_github_username
GHCR_TOKEN=your_github_pat

# Image Name
# Must match the image built by CI (ghcr.io/owner/repo:latest)
IMAGE_NAME=ghcr.io/tytaniumdev/mythicplusdiscordbot
IMAGE_TAG=latest

# GitHub Token for Issue Integration
# Required for /bug and /featurerequest commands.
# Needs 'repo' scope (Classic) or 'Issues: Read/Write' (Fine-grained).
GITHUB_TOKEN=your_github_pat

# Firebase Credentials (JSON)
# Required for Activity features. Minify the JSON to a single line.
FIREBASE_CREDENTIALS_JSON='{"type": "service_account", ...}'
```

**Note:** For `FIREBASE_CREDENTIALS_JSON`, ensure the JSON string is valid and enclosed in single quotes `'` to prevent shell parsing issues.

## 3. Discord Developer Portal (bot permissions)

Configure the bot in the [Discord Developer Portal](https://discord.com/developers/applications): select your application → **Bot** and **OAuth2**.

### 3.1 Privileged intents (Bot → Privileged Gateway Intents)

Enable these so the bot can read members and message content:

- **Server Members Intent** — required for role-based player lists and nicknames (e.g. `/wheel`).
- **Message Content Intent** — required if the bot uses the message content of legacy prefix commands.

Save changes after toggling intents.

### 3.2 Bot permissions (OAuth2 → URL Generator or invite)

When inviting the bot or generating an invite URL, include at least these **scopes** and **permissions**:

| Permission        | Why |
|-------------------|-----|
| **View Channel**  | See text and voice channels. |
| **Send Messages**  | Send group results and GIFs. |
| **Embed Links**    | Send embeds (e.g. group cards). |
| **Attach Files**   | Post the wheel GIF and other assets. |
| **Connect**        | Join voice channels. |
| **Speak**          | Play spin/reveal sounds in voice. |
| **Create Instant Invite** | Required for `!activity` (embedded activity invite). |
| **Read Message History** | Recommended so the bot can work in existing channels. |

Use **Bot** scope and the permissions above; add **applications.commands** if you use slash commands.

### 3.3 Activity (optional, for `!activity`)

The `!activity` command creates an embedded-application invite. Your app must be configured as an **Activity** in the portal:

1. In the Developer Portal: your application → **Activities** (or **Rich Presence** / app type).
2. Create or link an Activity so Discord allows `target_type=embedded_application` invites.
3. Set `DISCORD_APPLICATION_ID` in your `.env` file to your application’s **Application ID**.

## 4. First deploy

1.  **Clone the repo on the Pi**
    ```bash
    git clone https://github.com/TytaniumDev/MythicPlusDiscordBot.git ~/mythic-plus-bot
    cd ~/mythic-plus-bot
    ```

2.  **Create and Populate `.env`**
    Create the `.env` file as described in Section 2.

3.  **Start the Stack**
    ```bash
    docker compose up -d
    ```

4.  **Verify**
    ```bash
    docker compose ps
    ```
    You should see both `mythic-plus-bot` and `watchtower` running.

### 4.1 Data Persistence

The bot stores player preferences (roles) in a `data/` directory inside the repository folder on the Pi (`~/mythic-plus-bot/data`).
- This directory is created automatically by Docker when the container starts.
- It is ignored by git, so your data survives deployments.

## 5. Updates (Automatic)

**Watchtower** is configured to check for new images every 5 minutes.
When a new image is pushed to GHCR by the GitHub Actions workflow, Watchtower will:
1.  Detect the new image.
2.  Gracefully stop the bot container.
3.  Restart the bot with the new image and the same configuration (environment variables).

You do not need to do anything for code updates.

### Manual Updates (Configuration Changes)
If you change `docker-compose.yml` or the `.env` file (e.g., rotating tokens), you must manually apply the changes:
```bash
cd ~/mythic-plus-bot
git pull
docker compose up -d
```
This recreates the containers with the new configuration.

## 6. GitHub Issues Integration

To enable the `/bug` and `/featurerequest` commands, you need a Personal Access Token (PAT).

### 6.1 Create a PAT

**Option A: Classic Token (Easier)**
1. Go to **Settings** -> **Developer settings** -> **Personal access tokens** -> **Tokens (classic)**.
2. Generate a new token.
3. Select the **repo** scope (Full control of private repositories).
4. Copy the generated token.

**Option B: Fine-grained Token**
1. Go to **Settings** -> **Developer settings** -> **Personal access tokens** -> **Fine-grained tokens**.
2. Generate a new token and select your repository.
3. Under **Repository permissions**, grant **Issues** access: **Read and Write**.

### 6.2 Configure
Add the token to your `.env` file as `GITHUB_TOKEN`.
