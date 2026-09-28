import { FirebaseService } from '../core/firebaseService.js';
import logger from '../core/logger.js';
import { getPlayerList, type DiscordMember } from '../core/utils.js';
import { buildVoiceChannelsSnapshot } from '../core/discordAdapters.js';

interface ActiveChannel {
  docId: string;
  guildId: string;
}

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

export class SessionService {
  bot: Bot;
  firebase: FirebaseService;
  activeChannels = new Map<string, ActiveChannel>();

  constructor(bot: Bot, firebase?: FirebaseService) {
    this.bot = bot;
    this.firebase = firebase ?? FirebaseService.getInstance();
  }

  /**
   * Start tracking a channel's voice members for its lobby doc.
   * Idempotent — re-registering an already-active channel is a no-op
   * regardless of which side calls it (refresh listener, command handler).
   */
  registerChannel(channelId: string, guildId: string, docId: string): void {
    if (this.activeChannels.has(channelId)) return;
    this.activeChannels.set(channelId, { docId, guildId });
  }

  shutdown(): void {
    this.activeChannels.clear();
    logger.info('SessionService shutdown complete.');
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

    this.activeChannels.set(voiceChannelId, {
      docId: channelDocId,
      guildId,
    });

    await this.updateChannelPlayers(voiceChannelId, ctx.guild);

    return [guildDocId, channelDocId];
  }

  async updateChannelPlayers(channelId: string, guild: Guild): Promise<void> {
    const active = this.activeChannels.get(channelId);
    if (!active) return;

    const channel = guild.get_channel(channelId);
    let playersData: Record<string, unknown>[] = [];

    if (channel) {
      const members = channel.members.filter((m) => !m.bot);
      const players = getPlayerList(members);
      playersData = players.map((p) => p.toDict());
    }

    await this.firebase.updateChannelDoc(active.docId, { players: playersData });
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
    const active = this.activeChannels.get(channelId);
    if (!active) return;

    this.activeChannels.delete(channelId);
    await this.firebase.deleteChannelDoc(active.docId);
  }

  handleCollectionRemoved(change: {
    document: { id: string };
  }): void {
    const channelId = change.document.id;
    if (this.activeChannels.delete(channelId)) {
      logger.info(`Channel ${channelId} removed from tracking`);
    }
  }
}
