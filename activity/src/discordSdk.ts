import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';
import { reportError } from './lib/sentry';

interface DiscordContext {
  guildId: string;
  channelId: string | null;
}

interface DiscordParticipant {
  id: string;
  nickname: string | null;
  global_name: string | null;
  username: string;
}

// Detect embedded mode early and patch network URLs before Firebase initializes.
// Discord's activity proxy blocks direct requests to external domains — all
// traffic must go through URL mappings configured in the Developer Portal.
// Being in an iframe isn't sufficient (Storybook's preview is also iframed);
// we additionally require the `frame_id` query param that Discord always
// appends to activity URLs.
let _isEmbedded = false;
try {
  const inIframe = window.self !== window.top;
  const hasFrameId = new URLSearchParams(window.location.search).has('frame_id');
  _isEmbedded = inIframe && hasFrameId;
} catch {
  _isEmbedded = true;
}

// Hosts whose images are loaded via <img src>. They need both a patchUrlMappings
// entry (so the SDK whitelists them) AND a Developer Portal URL mapping.
const IMAGE_HOST_MAPPINGS: { prefix: string; target: string }[] = [
  // Battle.net character renders (profile pictures)
  { prefix: '/blizzard-renders', target: 'render.worldofwarcraft.com' },
  // Raider.io dungeon icons
  { prefix: '/raiderio-cdn', target: 'cdn.raiderio.net' },
];

if (_isEmbedded) {
  const mappings: { prefix: string; target: string }[] = [
    { prefix: '/firebase', target: 'firestore.googleapis.com' },
    // Firebase Auth endpoints needed for anonymous sign-in
    { prefix: '/auth', target: 'identitytoolkit.googleapis.com' },
    { prefix: '/authtoken', target: 'securetoken.googleapis.com' },
    ...IMAGE_HOST_MAPPINGS,
    // Raider.io character search + profile lookup
    { prefix: '/raiderio', target: 'raider.io' },
  ];

  // Cloud Functions callable endpoint must also be proxied in embedded mode.
  // NOTE: All prefix → target mappings must also be added in the Discord Developer Portal.
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (projectId) {
    mappings.push({ prefix: '/functions', target: `us-central1-${projectId}.cloudfunctions.net` });
  }

  patchUrlMappings(mappings);
}

/**
 * Rewrite an external image URL to go through Discord's activity proxy.
 * Must be used for <img> src attributes since patchUrlMappings only patches fetch/XHR.
 */
export function remapImageUrl(url: string | null | undefined): string | null {
  if (!url || !_isEmbedded) return url || null;
  try {
    const parsed = new URL(url);
    const mapping = IMAGE_HOST_MAPPINGS.find(m => m.target === parsed.hostname);
    if (mapping) {
      return `${mapping.prefix}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return url;
  } catch {
    return url;
  }
}

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
    reportError(e, { tag: 'discordSdk.init' });
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
    reportError(e, { tag: 'discordSdk.getParticipants' });
    return [];
  }
}
