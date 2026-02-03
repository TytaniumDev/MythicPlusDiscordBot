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
    If you plan to use GitHub Actions secrets, you can skip the `.env` file entirely.

4.  **Data persistence**:
    The default `docker-compose.yml` stores `player_preferences.json` in a named volume mounted at `/data`.
    If you want to customize the location, set `PREFERENCES_PATH` or `DATA_DIR`.

## 2. Tailscale setup (recommended, no public SSH)

This setup keeps SSH off the public internet while still allowing push-based deploys.

1. **Install Tailscale on the Pi**:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   ```
2. **Join your tailnet**:
   ```bash
   sudo tailscale up
   ```
   Follow the login link to authorize the device.
3. **Find the Tailscale hostname or IP** (from the Tailscale admin console or `tailscale status`).
   This value will be used for `PI_HOST`.
4. **Ensure SSH is running** on the Pi (standard `openssh-server` is fine).
   You do not need to open port 22 on your router when using Tailscale.
5. **Ensure Tailscale starts on boot**:
   ```bash
   sudo systemctl enable --now tailscaled
   sudo systemctl status tailscaled
   ```

## 3. SSH hardening (Tailscale-only)

If you only plan to SSH over Tailscale, you can lock SSH down further.

1. **Back up your SSH config**:
   ```bash
   sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
   ```
2. **Add a Tailscale-only SSH config**:
   ```bash
   sudo tee /etc/ssh/sshd_config.d/99-tailscale.conf >/dev/null <<'EOF'
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   PermitRootLogin no
   PubkeyAuthentication yes
   AuthenticationMethods publickey
   AllowTcpForwarding no
   X11Forwarding no
   EOF
   ```
3. **Restrict SSH to the Tailscale interface (recommended)**:
   ```bash
   sudo apt-get update && sudo apt-get install -y ufw
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow in on tailscale0 to any port 22
   sudo ufw enable
   ```
4. **Validate and restart SSH**:
   ```bash
   sudo sshd -t
   sudo systemctl restart ssh
   ```
   Keep your current SSH session open while testing new settings.

## 4. GitHub Secrets for CI/CD

The workflow in `.github/workflows/ci-cd.yml` builds the Docker image, pushes it to GitHub Container Registry (GHCR), then SSHs into the Pi to pull and restart the container.

**Required secrets**:
- `PI_HOST`: Tailscale hostname or IP of the Pi (e.g., `pi.yourtailnet.ts.net`).
- `PI_USER`: SSH username.
- `PI_SSH_KEY`: private key for SSH access.
- `PI_APP_DIR`: path to the repo on the Pi (e.g., `/home/pi/mythic-plus-bot`).
- `GHCR_TOKEN`: GitHub PAT with `read:packages` scope (used by the Pi to pull the image).
  If you do not see a Packages permission in fine-grained tokens, create a **classic** PAT
  with `read:packages` (and `repo` if the repository is private).
- `BOT_TOKEN`: Discord bot token (used on each deploy to set runtime env vars).
- `DISCORD_APPLICATION_ID`: Discord application ID (used on each deploy to set runtime env vars).
- `TS_AUTHKEY`: Tailscale auth key (recommended to create as reusable + ephemeral).

**Optional secrets**:
- `PI_SSH_PORT`: SSH port (defaults to 22).
- `DEPLOY_WEBHOOK_URL`: Discord webhook URL for deploy notifications.
You do not need to create a `.env` file on the Pi if you set `BOT_TOKEN` and `DISCORD_APPLICATION_ID` as GitHub secrets. The deploy job exports them before running `docker compose`, so the container gets the values at runtime.

### How to add the secrets
1. Go to **GitHub repo → Settings → Secrets and variables → Actions**.
2. Click **New repository secret** for each key.
3. Use the following values:
   - `PI_HOST`: Tailscale hostname or IP (e.g., `pi.yourtailnet.ts.net`).
   - `PI_USER`: SSH user on the Pi (e.g., `pi` or `deploy`).
   - `PI_SSH_KEY`: **private** SSH key contents.
   - `PI_APP_DIR`: path to the repo on the Pi (e.g., `/home/pi/mythic-plus-bot`).
   - `GHCR_TOKEN`: GitHub PAT with `read:packages`.
   - `BOT_TOKEN`: Discord bot token.
   - `DISCORD_APPLICATION_ID`: Discord app ID.
   - `TS_AUTHKEY`: Tailscale auth key.

### Generating a deploy SSH key
On the Pi (or your local machine), create a deploy key and add the public key to the Pi:
```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_ed25519
cat ~/.ssh/github_actions_ed25519.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```
Use the contents of `~/.ssh/github_actions_ed25519` for `PI_SSH_KEY`.

### Creating a Tailscale auth key
In the Tailscale admin console, go to **Settings → Keys → Generate auth key**.
Recommended settings:
- Reusable: **on**
- Ephemeral: **on**
- Tags: optional (use if you want to restrict access)

## 5. How the GitHub Actions workflow works

1. Runs unit tests.
2. Builds a multi-arch Docker image (amd64 + arm64) and pushes it to GHCR.
3. SSHs to the Pi and runs `docker compose pull` followed by `docker compose up -d`.
4. Verifies container health, restarts once if unhealthy, and optionally sends a Discord notification.

The deploy step exports `IMAGE_NAME` and `IMAGE_TAG` for `docker-compose.yml` so the Pi always pulls the exact build that passed CI.

## 6. Manual deploy/update (if needed)

On the Pi:
```bash
cd ~/mythic-plus-bot
export IMAGE_NAME=ghcr.io/<owner>/<repo>
export IMAGE_TAG=latest
docker compose pull
docker compose up -d --remove-orphans
```

## 7. Discord Developer Portal (for Activities)

To enable the `!activity` command, you need to configure your bot as a Discord Activity.

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Select your Application.
3.  Go to **Activities** -> **Getting Started**.
4.  Set up the **URL Mapping**:
    - Set the origin to your GitHub Pages URL (see below).
5.  Note your **Application ID** and ensure it's in the `.env` file as `DISCORD_APPLICATION_ID`.

## 8. Hosting the Activity (GitHub Pages)

The Discord Activity is a static web app located in the `activity/` folder.

1.  Create a new repository on GitHub.
2.  Upload the contents of the `activity/` folder (`index.html`, `style.css`, `script.js`) to the repository.
3.  Enable **GitHub Pages** in the repository settings (Settings -> Pages).
4.  Once deployed, you will get a URL like `https://yourusername.github.io/your-repo/`.
5.  Use this URL in the Discord Developer Portal for URL Mapping.

## 9. Bot Commands

- `!wheel`: The classic text-based reveal.
- `!newwheel`: Enhanced UI with Voice Channel integration, sound effects, and a spinning wheel GIF.
- `!activity`: Everything in `!newwheel` plus an invite to join the Discord Activity for a synchronized wheel experience.

## 10. Troubleshooting

- **Audio not working**: Ensure the bot has "Connect" and "Speak" permissions in the voice channel.
- **Activity not starting**: Ensure the `DISCORD_APPLICATION_ID` is correct and the URL mapping in the Discord Developer Portal is properly configured.
- **Docker issues**: Check logs with `docker compose logs -f`.
- **Manual Asset Setup**: If you are not using Docker, you can run `python3 setup_assets.py` manually to prepare the sounds and GIF.
