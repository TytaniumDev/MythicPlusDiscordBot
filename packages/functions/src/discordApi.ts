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

/**
 * The application's public key, which signs the interactions Discord sends to
 * `discordInteractions`. Read with the bot token so there's nothing else to
 * configure.
 */
export async function fetchVerifyKey(botToken: string): Promise<string> {
  const response = await fetch(`${DISCORD_API}/applications/@me`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to read the application: ${response.status}`);
  }
  const data = (await response.json()) as { verify_key?: unknown };
  if (typeof data.verify_key !== 'string' || !/^[0-9a-f]{64}$/.test(data.verify_key)) {
    throw new Error('The application has no verify key');
  }
  return data.verify_key;
}
