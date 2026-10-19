---
name: pi-ops
description: Access the production Raspberry Pi that runs the bot — SSH in, read container logs, check or restart the bot. Use when debugging production behavior or a failed deploy.
---

# Production host (Raspberry Pi)

The bot runs as a Docker container (`mythic-plus-bot`, see `docker-compose.yml`) on a Raspberry Pi reachable over Tailscale. Deploys happen automatically via `.github/workflows/deploy.yml` on push to `main` — don't deploy by hand.

Connection details are stored in Doppler (production config), not in this repo:

- **PI_HOST** – the Pi's Tailscale IP
- **PI_USER** – SSH user
- **PI_APP_DIR** – the repo clone on the Pi (`docker-compose.yml` lives here; there is no `.env`, secrets are passed in at deploy time)
- **PI_SSH_KEY** – SSH private key (never print or commit it)

Access requires being on the tailnet with `PI_SSH_KEY` loaded (temp file with `chmod 600`, or ssh-agent). Cloud sandboxes usually can't reach the Tailscale IP — if SSH times out, say so rather than retrying.

```bash
ssh "$PI_USER@$PI_HOST"

# Recent bot logs
docker logs mythic-plus-bot --since 30m

# Container status / health (healthy = connected to Discord in the last 90s)
docker ps --filter name=mythic-plus-bot

cd "$PI_APP_DIR"
```

Ask the user before restarting the container or changing anything on the host.
