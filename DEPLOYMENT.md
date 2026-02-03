# Deployment Guide (Docker + GitHub Actions over Tailscale)

This guide documents the only supported deployment flow for this project:
Docker images built by GitHub Actions and deployed to a Raspberry Pi over Tailscale.
There are no `.env` files on the Pi; secrets are injected at deploy time.

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
Find the Tailscale hostname or IP:
```bash
tailscale status
tailscale ip -4
```
Use this value for the `PI_HOST` secret (example: `pi.something.ts.net`).

### 1.4 Install SSH server and add deploy key
```bash
sudo apt-get install -y openssh-server
sudo systemctl enable --now ssh
```

Generate a deploy key (do this on the Pi or your local machine):
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

Save the private key for the `PI_SSH_KEY` secret:
```bash
cat ~/.ssh/github_actions_ed25519
```

### 1.5 Lock down SSH (Tailscale-only)
```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo tee /etc/ssh/sshd_config.d/99-tailscale.conf >/dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AuthenticationMethods publickey
AllowTcpForwarding no
X11Forwarding no
EOF
sudo apt-get update && sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0 to any port 22
sudo ufw enable
sudo sshd -t
sudo systemctl restart ssh
```
Keep your current SSH session open while testing new settings.

### 1.6 Clone the repo on the Pi
```bash
sudo -u deploy git clone https://github.com/TytaniumDev/MythicPlusDiscordBot.git /home/deploy/mythic-plus-bot
```
Use this path for the `PI_APP_DIR` secret.

## 2. GitHub Secrets for CI/CD

Go to GitHub repo -> Settings -> Secrets and variables -> Actions.
Click New repository secret for each:

### Required
- `TS_AUTHKEY`: Tailscale auth key (reusable + ephemeral recommended).
- `PI_HOST`: Tailscale hostname or IP (example: `pi.something.ts.net`).
- `PI_USER`: SSH user on the Pi (example: `deploy`).
- `PI_SSH_KEY`: Private SSH key contents from step 1.4.
- `PI_APP_DIR`: Repo path on the Pi (example: `/home/deploy/mythic-plus-bot`).
- `GHCR_TOKEN`: GitHub PAT with `read:packages`.
  If fine-grained tokens do not show Packages, use a classic PAT with `read:packages`
  (and `repo` if the repo is private).
- `BOT_TOKEN`: Discord bot token.
- `DISCORD_APPLICATION_ID`: Discord app ID (same as the Application ID in the portal; needed for the `!activity` invite).

### Optional
- `PI_SSH_PORT`: Defaults to 22 if omitted.
- `DEPLOY_WEBHOOK_URL`: Discord webhook for deploy notifications.

### Create a Tailscale auth key
In the Tailscale admin console: Settings -> Keys -> Generate auth key.
Recommended settings:
- Reusable: on
- Ephemeral: on

## 3. Discord Developer Portal (bot permissions)

Configure the bot in the [Discord Developer Portal](https://discord.com/developers/applications): select your application → **Bot** and **OAuth2**.

### 3.1 Privileged intents (Bot → Privileged Gateway Intents)

Enable these so the bot can read members and message content:

- **Server Members Intent** — required for role-based player lists and nicknames (e.g. `!wheel`, `!rolecheck`).
- **Message Content Intent** — required if the bot uses the message content of commands (e.g. `!wheel`).

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

To update an already-invited bot: use a new invite URL with the same permissions and re-invite (or re-authorize when Discord prompts). Role/position of the bot in the server can affect whether it can create invites or speak in voice.

### 3.3 Permissions integer in code

If you copy the **permissions integer** from the Discord Developer Portal (OAuth2 → URL Generator, shown at the bottom when you select permissions), you can use it in this project so the bot generates invite URLs with those permissions:

1. **Config / env:** Set `BOT_INVITE_PERMISSIONS` to that integer (e.g. `3263489`). In `config.py` it defaults to `3263489`; override with the `BOT_INVITE_PERMISSIONS` environment variable (e.g. in `.env` or GitHub Secrets) if you use a different value.
2. **Invite URL in Discord:** Run `!invite` in any channel where the bot can reply. The bot will post an “Add this bot to a server” link that uses the configured permissions. Use that link to add the bot to a server or to re-invite with updated permissions.

The permissions integer is only used when generating the OAuth2 invite URL; it does not change the bot’s behavior inside a server. Server admins still grant permissions when they complete the invite flow.

### 3.4 Activity (optional, for `!activity`)

The `!activity` command creates an embedded-application invite. Your app must be configured as an **Activity** in the portal:

1. In the Developer Portal: your application → **Activities** (or **Rich Presence** / app type).
2. Create or link an Activity so Discord allows `target_type=embedded_application` invites.
3. Set the **DISCORD_APPLICATION_ID** secret (and `DISCORD_APPLICATION_ID` in `.env` locally) to your application’s **Application ID** (Application → General Information).

If Activities are not set up, `!activity` will fail; `!wheel` and `!newwheel` (voice + GIFs) still work with the permissions above.

## 4. First deploy

1. Push to `main`/`master`.
2. Watch the GitHub Actions workflow run.
3. On the Pi, confirm the container is running:
   ```bash
   docker compose -f /home/deploy/mythic-plus-bot/docker-compose.yml ps
   ```

### 4.1 Data Persistence

The bot now stores player preferences (roles) in a `data/` directory inside the repository folder on the Pi (`/home/deploy/mythic-plus-bot/data`).
- This directory is created automatically by Docker when the container starts.
- It is ignored by git (via `.gitignore`), so your data survives deployments and `git reset`.
- You can back up this file manually: `cp /home/deploy/mythic-plus-bot/data/player_preferences.json ~/.backup_prefs.json`.

## 5. Verification checklist

Run these checks if a deploy fails or you want to validate the setup.

### 5.1 Tailscale connectivity
On your local machine (or another device on your tailnet):
```bash
ping -c 3 pi.something.ts.net
ssh deploy@pi.something.ts.net
```

### 5.2 SSH access and permissions
On the Pi:
```bash
whoami
groups
docker ps
```
You should see your user in the `docker` group.

### 5.3 Repo path and compose config
```bash
ls -la /home/deploy/mythic-plus-bot
docker compose -f /home/deploy/mythic-plus-bot/docker-compose.yml config
```

### 5.4 Container health
```bash
docker compose -f /home/deploy/mythic-plus-bot/docker-compose.yml ps
docker inspect -f '{{.State.Health.Status}}' mythic-plus-bot
```

### 5.5 GitHub Actions logs
In GitHub:
**Actions → CI and Deploy → deploy job**
Look for:
- Successful Tailscale connection
- SSH step completed
- `docker compose pull` and `up` succeeded

## 6. Updates

Any push to `main`/`master` rebuilds the image and redeploys to the Pi automatically.
Each deploy runs `git fetch origin` and `git reset --hard origin/<branch>` in the Pi's repo directory so the clone (including `docker-compose.yml`) stays in sync with the deployed branch. Any local changes in that directory will be overwritten.
