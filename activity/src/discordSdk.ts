import { DiscordSDK } from '@discord/embedded-app-sdk';

/**
 * Initialize the Discord Embedded App SDK and return the guild ID.
 * Only works when the app is running inside a Discord activity iframe.
 * Returns null if not embedded or on any failure.
 */
export async function setupDiscordSdk(): Promise<string | null> {
  // Check if we're inside an iframe (Discord activities always load in an iframe)
  let isEmbedded = false;
  try {
    isEmbedded = window.self !== window.top;
  } catch {
    // Cross-origin iframe — we're embedded
    isEmbedded = true;
  }

  if (!isEmbedded) return null;

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;
  if (!clientId) {
    console.warn('VITE_DISCORD_CLIENT_ID not set, cannot init Discord SDK');
    return null;
  }

  try {
    const discordSdk = new DiscordSDK(clientId);
    await discordSdk.ready();
    return discordSdk.guildId;
  } catch (e) {
    console.error('Discord SDK init failed', e);
    return null;
  }
}
