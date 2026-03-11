import { WoWGroup } from '@mythicplus/shared';
import { FirebaseService } from '../core/firebaseService.js';
import { buildGroupEmbed } from '../core/groupUi.js';
import logger from '../core/logger.js';
import { getPlayerList, type DiscordMember } from '../core/utils.js';

export interface ActiveChannel {
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
  activeGuilds = new Set<string>();
  activeChannels = new Map<string, ActiveChannel>();
  channelListeners = new Map<string, { unsubscribe(): void }>();
  guildListeners = new Map<string, { unsubscribe(): void } | null>();
  announcedChannels = new Set<string>();

  constructor(bot: Bot, firebase?: FirebaseService) {
    this.bot = bot;
    this.firebase = firebase ?? FirebaseService.getInstance();
  }

  shutdown(): void {
    for (const watch of this.channelListeners.values()) {
      watch?.unsubscribe();
    }
    this.channelListeners.clear();

    for (const watch of this.guildListeners.values()) {
      watch?.unsubscribe();
    }
    this.guildListeners.clear();

    this.activeChannels.clear();
    this.activeGuilds.clear();
    this.announcedChannels.clear();

    logger.info('SessionService shutdown complete — all listeners unsubscribed.');
  }

  async getOrCreateSession(
    ctx: {
      guild: { id: string; name: string; icon?: { url: string } | null; voice_channels: VoiceChannel[] } | null;
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
    this.activeGuilds.add(guildId);

    await this.refreshGuildVoiceChannels(ctx.guild as unknown as Guild);

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

    await this.updateChannelPlayers(voiceChannelId, ctx.guild as unknown as Guild);

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
    const voiceChannelsData: { id: string; name: string; userCount: number }[] = [];
    for (const vc of guild.voice_channels) {
      const count = vc.members.filter((m) => !m.bot).length;
      voiceChannelsData.push({
        id: vc.id,
        name: vc.name,
        userCount: count,
      });
    }

    voiceChannelsData.sort((a, b) => {
      if (b.userCount !== a.userCount) return b.userCount - a.userCount;
      return a.name.localeCompare(b.name);
    });

    await this.firebase.updateGuildDoc(guild.id, {
      voiceChannels: voiceChannelsData,
    });
  }

  async announceCompletion(
    channel: VoiceChannel,
    data: Record<string, unknown>,
  ): Promise<void> {
    const groupsData = (data.groups ?? []) as Record<string, unknown>[];
    const groups = groupsData.map((g) => WoWGroup.fromDict(g));

    if (groups.length === 0) {
      await channel.send('No groups were formed this round.');
      return;
    }

    try {
      for (let i = 0; i < groups.length; i++) {
        const embed = buildGroupEmbed(groups[i], i + 1);
        await channel.send({ embed });
      }
    } catch (e) {
      logger.warn(`Could not send completion embed to channel ${channel.id}: ${e}`);
    }
  }

  async cleanupChannel(channelId: string): Promise<void> {
    const active = this.activeChannels.get(channelId);
    if (!active) return;

    this.activeChannels.delete(channelId);
    this.announcedChannels.delete(active.docId);

    if (this.channelListeners.has(active.docId)) {
      const watch = this.channelListeners.get(active.docId);
      watch?.unsubscribe();
      this.channelListeners.delete(active.docId);
    }

    await this.firebase.deleteChannelDoc(active.docId);
    await this._asyncCleanupGuildIfEmpty(active.guildId);
  }

  private async _asyncCleanupGuildIfEmpty(guildId: string): Promise<void> {
    const guildHasChannels = [...this.activeChannels.values()].some(
      (ac) => ac.guildId === guildId,
    );
    if (!guildHasChannels) {
      this.activeGuilds.delete(guildId);
      await this.firebase.deleteGuildDoc(guildId);
      if (this.guildListeners.has(guildId)) {
        const watch = this.guildListeners.get(guildId);
        watch?.unsubscribe();
        this.guildListeners.delete(guildId);
      }
    }
  }

  handleCollectionRemoved(change: {
    document: { id: string };
  }): void {
    const channelId = change.document.id;

    const active = this.activeChannels.get(channelId);
    if (active) {
      this.activeChannels.delete(channelId);
      this.announcedChannels.delete(channelId);
      if (this.channelListeners.has(channelId)) {
        const watch = this.channelListeners.get(channelId);
        watch?.unsubscribe();
        this.channelListeners.delete(channelId);
      }
      logger.info(`Channel ${channelId} removed from tracking`);
      this._cleanupGuildIfEmpty(active.guildId);
    }
  }

  private _cleanupGuildIfEmpty(guildId: string): void {
    const guildHasChannels = [...this.activeChannels.values()].some(
      (ac) => ac.guildId === guildId,
    );
    if (!guildHasChannels) {
      this.activeGuilds.delete(guildId);
      if (this.guildListeners.has(guildId)) {
        const watch = this.guildListeners.get(guildId);
        watch?.unsubscribe();
        this.guildListeners.delete(guildId);
      }
    }
  }

  getActiveChannelIdsForGuild(guildId: string): string[] {
    return [...this.activeChannels.entries()]
      .filter(([, ac]) => ac.guildId === guildId)
      .map(([chId]) => chId);
  }
}
