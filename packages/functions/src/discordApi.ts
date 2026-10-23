const DISCORD_API = 'https://discord.com/api/v10';

/** DM a Discord user as the Wheelson bot. Throws if Discord refuses. */
export async function sendDiscordDm(
  botToken: string,
  userId: string,
  content: string,
): Promise<void> {
  const headers = {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json',
  };

  // Open DM channel
  const channelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!channelRes.ok) {
    throw new Error(`Failed to open DM channel: ${channelRes.status}`);
  }
  const channel = (await channelRes.json()) as { id: string };

  // Send message
  const msgRes = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });
  if (!msgRes.ok) {
    throw new Error(`Failed to send DM message: ${msgRes.status}`);
  }
}
