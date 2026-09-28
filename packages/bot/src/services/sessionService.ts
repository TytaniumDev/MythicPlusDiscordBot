import { FirebaseService } from '../core/firebaseService.js';
import logger from '../core/logger.js';
import { reportError } from '../core/sentry.js';
import { toLobbyMember, type DiscordMember } from '../core/utils.js';
import { buildVoiceChannelsSnapshot } from '../core/discordAdapters.js';

export interface VoiceChannel {
  id: string;
  name: string;
  members: (DiscordMember & { bot: boolean })[];
  send(content: string | { embed: unknown }): Promise<unknown>;
}

export interface Guild {
  id: string;
  name: string;
  icon?: { url: string } | null;
  voice_channels: VoiceChannel[];
  get_channel(id: string): VoiceChannel | null;
}

export interface Bot {
  get_guild(id: string): Guild | null;
  loop?: unknown;
}

export interface VoiceState {
  channel: { id: string; members: { bot: boolean }[] } | null;
}

/**
 * Keeps each lobby doc's `members` in sync with its voice channel.
 *
 * The set of lobbies comes from Firestore, not memory: `listen()` follows the
 * `channels` collection, so a lobby created by `/wheelson` or by the activity
 * is tracked the moment its doc appears, and a restarted bot picks up every
 * existing lobby again. Channel doc IDs are the voice channel IDs.
 */
export class SessionService {
  bot: Bot;
  firebase: FirebaseService;
  /** Tracked lobbies: voice channel ID → guild ID. */
  activeChannels = new Map<string, string>();

  constructor(bot: Bot, firebase?: FirebaseService) {
    this.bot = bot;
    this.firebase = firebase ?? FirebaseService.getInstance();
  }

  /** Start following lobby docs. Returns null when Firebase is unavailable. */
  listen(): { unsubscribe(): void } | null {
    return this.firebase.listenForChannels({
      onAdded: (channelId, data) => {
        const guildId = typeof data.guildId === 'string' ? data.guildId : '';
        if (!guildId) {
          logger.warn(`Lobby ${channelId} has no guildId; not tracking it`);
          return;
        }
        this.trackChannel(channelId, guildId).catch((err) => {
          reportError(err, { tags: { handler: 'sessionService.trackChannel' }, extra: { channelId } });
        });
      },
      onRemoved: (channelId) => this.untrackChannel(channelId),
    });
  }

  /** Track a lobby and publish its current voice members. Idempotent. */
  async trackChannel(channelId: string, guildId: string): Promise<void> {
    this.activeChannels.set(channelId, guildId);
    await this.syncMembers(channelId);
  }

  untrackChannel(channelId: string): void {
    if (this.activeChannels.delete(channelId)) {
      logger.info(`Lobby ${channelId} removed from tracking`);
    }
  }

  shutdown(): void {
    this.activeChannels.clear();
    logger.info('SessionService shutdown complete.');
  }

  /** Write the lobby's `members` from who is in the voice channel right now. */
  async syncMembers(channelId: string): Promise<void> {
    const guildId = this.activeChannels.get(channelId);
    if (!guildId) return;

    const channel = this.bot.get_guild(guildId)?.get_channel(channelId) ?? null;
    const members = channel
      ? channel.members.filter((m) => !m.bot).map(toLobbyMember)
      : [];
    await this.firebase.setChannelMembers(channelId, members);
  }

  async onVoiceStateUpdate(before: VoiceState, after: VoiceState): Promise<void> {
    if (before.channel?.id === after.channel?.id) return;

    if (before.channel && this.activeChannels.has(before.channel.id)) {
      const humans = before.channel.members.filter((m) => !m.bot);
      if (humans.length === 0) {
        await this.cleanupChannel(before.channel.id);
      } else {
        await this.syncMembers(before.channel.id);
      }
    }

    if (after.channel && this.activeChannels.has(after.channel.id)) {
      await this.syncMembers(after.channel.id);
    }
  }

  async getOrCreateSession(
    ctx: {
      guild: Guild | null;
      author: { voice?: { channel?: { id: string; name: string } | null } | null };
    },
    debug = false,
  ): Promise<[string, string] | null> {
    if (!this.firebase.isAvailable()) return null;
    if (!ctx.guild) return null;

    const guildId = ctx.guild.id;
    const guildName = ctx.guild.name;
    const guildIconUrl = ctx.guild.icon?.url ?? null;

    const guildDocId = await this.firebase.getOrCreateGuildDoc(
      guildId,
      guildName,
      guildIconUrl ?? undefined,
    );

    await this.refreshGuildVoiceChannels(ctx.guild);

    const voiceChannelId = ctx.author.voice?.channel?.id ?? null;
    const voiceChannelName = ctx.author.voice?.channel?.name ?? '';

    if (voiceChannelId === null) return null;

    const channelDocId = await this.firebase.getOrCreateChannelDoc(
      voiceChannelId,
      guildId,
      voiceChannelName,
      debug,
    );

    // The channels listener also tracks a newly created doc; syncing here too
    // means the reply never races ahead of the roster.
    await this.trackChannel(voiceChannelId, guildId);

    return [guildDocId, channelDocId];
  }

  async refreshGuildVoiceChannels(guild: Guild): Promise<void> {
    const voiceChannelsData = buildVoiceChannelsSnapshot(guild.voice_channels, {
      sorted: true,
    });

    await this.firebase.updateGuildDoc(guild.id, {
      voiceChannels: voiceChannelsData,
    });
  }

  /**
   * The lobby emptied: delete its channel doc. The guild doc stays — it holds
   * today's group history and the season's pair counts.
   */
  async cleanupChannel(channelId: string): Promise<void> {
    if (!this.activeChannels.delete(channelId)) return;
    await this.firebase.deleteChannelDoc(channelId);
  }
}
