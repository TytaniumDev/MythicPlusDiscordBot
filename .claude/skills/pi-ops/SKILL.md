---
name: pi-ops
description: Access the production Raspberry Pi that runs the bot — SSH in, read container logs, check or restart the bot. Use when debugging production behavior or a failed deploy.
---

# Production host (Raspberry Pi)

The bot runs as a Docker container (`mythic-plus-bot`, see `docker-compose.yml`) on a Raspberry Pi reachable over Tailscale. Deploys happen automatically via `.github/workflows/deploy.yml` on push to `main` — don't deploy by hand.

Connection details are stored in Doppler:

- **PI_HOST** – `100.92.156.29` (Tailscale IP)
- **PI_USER** – `deploy`
- **PI_APP_DIR** – `/home/deploy/mythic-plus-bot`
- **PI_SSH_KEY** – SSH private key (Doppler only; never print or commit it)

Access requires being on the tailnet with `PI_SSH_KEY` loaded (temp file with `chmod 600`, or ssh-agent). Cloud sandboxes usually can't reach the Tailscale IP — if SSH times out, say so rather than retrying.

```bash
ssh deploy@100.92.156.29

# Recent bot logs
docker logs mythic-plus-bot --since 30m

# Container status / health
docker ps --filter name=mythic-plus-bot

# App directory (docker-compose.yml + .env live here)
cd /home/deploy/mythic-plus-bot
```

Ask the user before restarting the container or changing anything on the host.
