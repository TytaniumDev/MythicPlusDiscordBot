import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';

export interface DiscordContext {
  guildId: string;
  channelId: string | null;
}

// Detect embedded mode early and patch network URLs before Firebase initializes.
// Discord's activity proxy blocks direct requests to external domains — all
// traffic must go through URL mappings configured in the Developer Portal.
let _isEmbedded = false;
try {
  _isEmbedded = window.self !== window.top;
} catch {
  _isEmbedded = true;
}

if (_isEmbedded) {
  patchUrlMappings([
    { prefix: '/firebase', target: 'firestore.googleapis.com' },
  ]);
  console.log('[DiscordSDK] Patched URL mappings for embedded mode');
}

export const isEmbedded = _isEmbedded;

/**
 * Initialize the Discord Embedded App SDK and return the guild/channel context.
 * Only works when the app is running inside a Discord activity iframe.
 * Returns null if not embedded or on any failure.
 */
export async function setupDiscordSdk(): Promise<DiscordContext | null> {
  if (!_isEmbedded) return null;

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;
  if (!clientId) {
    console.warn('VITE_DISCORD_CLIENT_ID not set, cannot init Discord SDK');
    return null;
  }

  try {
    console.log('[DiscordSDK] Initializing with clientId:', clientId);
    const discordSdk = new DiscordSDK(clientId);
    await discordSdk.ready();
    console.log('[DiscordSDK] Ready. guildId:', discordSdk.guildId, 'channelId:', discordSdk.channelId);

    if (!discordSdk.guildId) return null;

    return {
      guildId: discordSdk.guildId,
      channelId: discordSdk.channelId,
    };
  } catch (e) {
    console.error('Discord SDK init failed', e);
    return null;
  }
}
