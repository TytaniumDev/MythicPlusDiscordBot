import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';

export interface DiscordContext {
  guildId: string;
  channelId: string | null;
}

export interface DiscordParticipant {
  id: string;
  nickname: string | null;
  global_name: string | null;
  username: string;
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
  const mappings: { prefix: string; target: string }[] = [
    { prefix: '/firebase', target: 'firestore.googleapis.com' },
  ];

  // Cloud Functions callable endpoint must also be proxied in embedded mode.
  // NOTE: A matching URL mapping must also be added in the Discord Developer Portal.
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (projectId) {
    mappings.push({ prefix: '/functions', target: `us-central1-${projectId}.cloudfunctions.net` });
  }

  patchUrlMappings(mappings);
}

export const isEmbedded = _isEmbedded;

let _sdkInstance: DiscordSDK | null = null;

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
    const discordSdk = new DiscordSDK(clientId);
    await discordSdk.ready();

    _sdkInstance = discordSdk;

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

/**
 * Get all participants connected to the current activity instance.
 * Returns empty array if not embedded or SDK not initialized.
 */
export async function getParticipants(): Promise<DiscordParticipant[]> {
  if (!_sdkInstance) return [];

  try {
    const result = await _sdkInstance.commands.getInstanceConnectedParticipants();
    return (result.participants ?? []).map((p: Record<string, unknown>) => ({
      id: (p.id ?? p.user_id ?? '') as string,
      nickname: (p.nickname ?? null) as string | null,
      global_name: (p.global_name ?? null) as string | null,
      username: (p.username ?? '') as string,
    }));
  } catch (e) {
    console.warn('[DiscordSDK] Failed to get participants:', e);
    return [];
  }
}
