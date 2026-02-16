# Deployment Guide (Docker + Watchtower)

This guide documents the deployment flow for this project:
Docker images are built by GitHub Actions and pushed to GHCR.
The Raspberry Pi runs **Watchtower**, which automatically pulls new images and restarts the bot.
The **.env** file on the Pi is created automatically by the **Provision** step when you run the Deploy workflow manually (no need to create it by hand).

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

### 1.3 Install and enable Tailscale
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
sudo systemctl enable --now tailscaled
```
Find the Tailscale hostname or IP for the **PI_HOST** secret:
```bash
tailscale status
tailscale ip -4
```
Use this value (e.g. `pi.something.ts.net`) when configuring GitHub Secrets.

### 1.4 Install SSH server and add deploy key
```bash
sudo apt-get install -y openssh-server
sudo systemctl enable --now ssh
```
Generate a deploy key (on the Pi or your machine):
```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_ed25519
```
Add the public key to the deploy user on the Pi:
```bash
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy chmod 700 /home/deploy/.ssh
cat ~/.ssh/github_actions_ed25519.pub | sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys >/dev/null
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys
```
Save the **private** key contents for the **PI_SSH_KEY** secret.

## 2. GitHub Secrets (for Provision)

The Provision step (run when you trigger the Deploy workflow manually) writes `.env` on the Pi from these repository secrets. No manual `.env` file on the server is required.

Go to **GitHub repo → Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| **PI_HOST** | Tailscale hostname or IP of the Pi (e.g. `pi.something.ts.net`). |
| **PI_USER** | SSH user on the Pi (e.g. `deploy`). |
| **PI_SSH_KEY** | Private SSH key contents (from step 1.4). |
| **PI_APP_DIR** | Repo path on the Pi (e.g. `/home/deploy/mythic-plus-bot`). |
| **TS_OAUTH_CLIENT_ID** | Tailscale OAuth client ID (Admin Console → Settings → OAuth clients). |
| **TS_OAUTH_SECRET** | Tailscale OAuth secret. |
| **GHCR_USER** | GitHub username for GHCR (used by Watchtower to pull images). |
| **GHCR_TOKEN** | GitHub PAT with `read:packages`. |
| **BOT_TOKEN** | Discord bot token. |
| **DISCORD_APPLICATION_ID** | Discord Application ID (for `/activity`). |
| **GH_ISSUE_TOKEN** | GitHub PAT with `repo` scope (for `/bug` and `/featurerequest`). |
| **FIREBASE_CREDENTIALS_JSON** | Firebase service account JSON (full key). |

Create a Tailscale OAuth client in the Tailscale admin console with **devices:write** scope so the Actions runner can join your tailnet.

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
    sudo -u deploy git clone https://github.com/TytaniumDev/MythicPlusDiscordBot.git /home/deploy/mythic-plus-bot
    ```
    Use the same path for the **PI_APP_DIR** secret (e.g. `/home/deploy/mythic-plus-bot`).

2.  **Ensure GitHub Secrets are set** (Section 2).

3.  **Run the Deploy workflow (manual trigger)**  
    In GitHub: **Actions → Deploy → Run workflow** (choose branch, then Run).  
    This will:
    - Build and push the Docker image to GHCR.
    - Connect to the Pi via Tailscale and SSH.
    - Write `.env` on the Pi from your secrets (GHCR_USER, GHCR_TOKEN, BOT_TOKEN, etc.).
    - Run `docker compose up -d` on the Pi.

4.  **Verify on the Pi**
    ```bash
    docker compose -f /home/deploy/mythic-plus-bot/docker-compose.yml ps
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
- **Rotating secrets (BOT_TOKEN, GHCR_TOKEN, etc.):** Update the values in **GitHub → Settings → Secrets**, then run **Actions → Deploy → Run workflow** again. The Provision step will overwrite `.env` on the Pi and restart the stack.
- **Changing `docker-compose.yml`:** On the Pi, `git pull` then `docker compose up -d` in the app directory.

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
Add the token as the **GH_ISSUE_TOKEN** repository secret. The Provision step writes it to `.env` as `GITHUB_TOKEN` on the Pi.
