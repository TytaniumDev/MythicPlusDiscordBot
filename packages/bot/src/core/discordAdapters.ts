import type { Guild as DjsGuild, VoiceChannel as DjsVoiceChannel } from 'discord.js';
import type { Guild, VoiceChannel } from '../services/sessionService.js';

/**
 * Lightweight voice-channel summary written to the activity Firestore guild
 * doc. The activity frontend reads `voiceChannels` to render the channel list.
 */
export interface VoiceChannelSnapshot {
  id: string;
  name: string;
  userCount: number;
}

/**
 * Minimal shape needed to compute a voice channel snapshot.
 * Both the adapter `VoiceChannel` and a freshly-adapted discord.js voice
 * channel satisfy this.
 */
interface VoiceChannelLike {
  id: string;
  name: string;
  members: ReadonlyArray<{ bot: boolean }>;
}

/**
 * Build the `{id, name, userCount}` snapshot list used by the activity
 * frontend. `userCount` excludes bots.
 *
 * When `sorted` is true (the default for the activity flow), channels are
 * sorted by userCount desc, then alphabetically by name. This matches the
 * behavior previously inlined at main.ts (guild refresh listener) and
 * sessionService.refreshGuildVoiceChannels.
 */
export function buildVoiceChannelsSnapshot(
  channels: Iterable<VoiceChannelLike>,
  options: { sorted?: boolean } = {},
): VoiceChannelSnapshot[] {
  const out: VoiceChannelSnapshot[] = [];
  for (const ch of channels) {
    const userCount = [...ch.members].filter((m) => !m.bot).length;
    out.push({ id: ch.id, name: ch.name, userCount });
  }
  if (options.sorted) {
    out.sort((a, b) => {
      if (b.userCount !== a.userCount) return b.userCount - a.userCount;
      return a.name.localeCompare(b.name);
    });
  }
  return out;
}

/**
 * Convert a discord.js Guild to the adapter `Guild` shape used by handler
 * code (sessionService, groups command, etc.).
 *
 * `voice_channels` is exposed via a getter so the discord.js channels cache
 * is read lazily — the adapter stays in sync with cache mutations between
 * the time the adapter is built and the time it's actually iterated. This
 * lazy-getter pattern was previously inlined at three sites in main.ts;
 * keeping it preserves the original semantics.
 */
export function adaptGuild(
  djsGuild: DjsGuild | null,
  adaptVoiceChannel: (ch: DjsVoiceChannel) => VoiceChannel,
): Guild | null {
  if (!djsGuild) return null;
  const iconUrl = djsGuild.iconURL();
  return {
    id: djsGuild.id,
    name: djsGuild.name,
    icon: iconUrl ? { url: iconUrl } : null,
    get voice_channels(): VoiceChannel[] {
      return djsGuild.channels.cache
        .filter((ch) => ch.isVoiceBased())
        .map((ch) => adaptVoiceChannel(ch as unknown as DjsVoiceChannel));
    },
    get_channel(chId: string): VoiceChannel | null {
      const ch = djsGuild.channels.cache.get(chId);
      if (!ch || !ch.isVoiceBased()) return null;
      return adaptVoiceChannel(ch as unknown as DjsVoiceChannel);
    },
  };
}
