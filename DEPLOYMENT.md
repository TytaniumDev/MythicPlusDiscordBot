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
- `DISCORD_APPLICATION_ID`: Discord app ID.

### Optional
- `PI_SSH_PORT`: Defaults to 22 if omitted.
- `DEPLOY_WEBHOOK_URL`: Discord webhook for deploy notifications.

### Create a Tailscale auth key
In the Tailscale admin console: Settings -> Keys -> Generate auth key.
Recommended settings:
- Reusable: on
- Ephemeral: on

## 3. First deploy

1. Push to `main`/`master`.
2. Watch the GitHub Actions workflow run.
3. On the Pi, confirm the container is running:
   ```bash
   docker compose -f /home/deploy/mythic-plus-bot/docker-compose.yml ps
   ```

## 4. Verification checklist

Run these checks if a deploy fails or you want to validate the setup.

### 4.1 Tailscale connectivity
On your local machine (or another device on your tailnet):
```bash
ping -c 3 pi.something.ts.net
ssh deploy@pi.something.ts.net
```

### 4.2 SSH access and permissions
On the Pi:
```bash
whoami
groups
docker ps
```
You should see your user in the `docker` group.

### 4.3 Repo path and compose config
```bash
ls -la /home/deploy/mythic-plus-bot
docker compose -f /home/deploy/mythic-plus-bot/docker-compose.yml config
```

### 4.4 Container health
```bash
docker compose -f /home/deploy/mythic-plus-bot/docker-compose.yml ps
docker inspect -f '{{.State.Health.Status}}' mythic-plus-bot
```

### 4.5 GitHub Actions logs
In GitHub:
**Actions → CI and Deploy → deploy job**
Look for:
- Successful Tailscale connection
- SSH step completed
- `docker compose pull` and `up` succeeded

## 5. Updates

Any push to `main`/`master` rebuilds the image and redeploys to the Pi automatically.
Each deploy runs `git fetch origin` and `git reset --hard origin/<branch>` in the Pi's repo directory so the clone (including `docker-compose.yml`) stays in sync with the deployed branch. Any local changes in that directory will be overwritten.
