import type { DiscordNames } from '@mythicplus/shared';

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

/** Where an activity instance runs and who has it open. */
export interface ActivityInstance {
  channelId: string;
  guildId: string | null;
  /** Discord IDs of the users with the activity open. */
  userIds: string[];
}

function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9]{1,32}$/.test(value);
}

/**
 * Look up a running instance of the Wheelson activity. Discord answers 404 once
 * everyone has closed it (or for an ID it never issued), and this returns null.
 * Throws on any other failure.
 */
export async function fetchActivityInstance(
  botToken: string,
  applicationId: string,
  instanceId: string,
): Promise<ActivityInstance | null> {
  const response = await fetch(
    `${DISCORD_API}/applications/${applicationId}/activity-instances/${encodeURIComponent(instanceId)}`,
    { headers: { Authorization: `Bot ${botToken}` } },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to read the activity instance: ${response.status}`);
  }
  const data = (await response.json()) as {
    location?: { channel_id?: unknown; guild_id?: unknown };
    users?: unknown;
  };
  const channelId = data.location?.channel_id;
  if (!isSnowflake(channelId) || !Array.isArray(data.users)) {
    throw new Error('Discord returned an unexpected activity instance');
  }
  return {
    channelId,
    guildId: isSnowflake(data.location?.guild_id) ? data.location.guild_id : null,
    userIds: data.users.filter(isSnowflake),
  };
}

/**
 * The names Discord has for a server member, or null when they aren't in the
 * server. Throws on any other failure.
 */
export async function fetchGuildMemberNames(
  botToken: string,
  guildId: string,
  userId: string,
): Promise<DiscordNames | null> {
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to read the guild member: ${response.status}`);
  }
  const data = (await response.json()) as {
    nick?: unknown;
    user?: { username?: unknown; global_name?: unknown };
  };
  const username = data.user?.username;
  if (typeof username !== 'string') {
    throw new Error('Discord returned an unexpected guild member');
  }
  return {
    nick: typeof data.nick === 'string' ? data.nick : null,
    globalName: typeof data.user?.global_name === 'string' ? data.user.global_name : null,
    username,
  };
}
