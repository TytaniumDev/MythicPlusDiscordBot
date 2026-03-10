import { WoWGroup, WoWPlayer, createMythicPlusGroups } from '@mythicplus/shared';
import { FirebaseService } from '../core/firebaseService.js';
import { buildGroupEmbed } from '../core/groupUi.js';
import logger from '../core/logger.js';
import { getPlayerList, type DiscordMember } from '../core/utils.js';
import type { GroupService } from './groupService.js';

export interface ActiveChannel {
  docId: string;
  guildId: number;
}

export interface VoiceChannel {
  id: number;
  name: string;
  members: (DiscordMember & { bot: boolean })[];
  send(content: string | { embed: unknown }): Promise<unknown>;
}

export interface Guild {
  id: number;
  name: string;
  icon?: { url: string } | null;
  voice_channels: VoiceChannel[];
  get_channel(id: number): VoiceChannel | null;
}

export interface Bot {
  get_guild(id: number): Guild | null;
  groupService?: GroupService;
  loop?: unknown;
}

export class SessionService {
  bot: Bot;
  firebase: FirebaseService;
  activeGuilds = new Set<number>();
  activeChannels = new Map<number, ActiveChannel>();
  channelListeners = new Map<string, { unsubscribe(): void }>();
  guildListeners = new Map<number, { unsubscribe(): void } | null>();
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
      guild: { id: number; name: string; icon?: { url: string } | null; voice_channels: VoiceChannel[] } | null;
      author: { voice?: { channel?: { id: number; name: string } | null } | null };
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

  async updateChannelPlayers(channelId: number, guild: Guild): Promise<void> {
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
    const guildIdStr = String(guild.id);

    const voiceChannelsData: { id: string; name: string; userCount: number }[] = [];
    for (const vc of guild.voice_channels) {
      const count = vc.members.filter((m) => !m.bot).length;
      voiceChannelsData.push({
        id: String(vc.id),
        name: vc.name,
        userCount: count,
      });
    }

    voiceChannelsData.sort((a, b) => {
      if (b.userCount !== a.userCount) return b.userCount - a.userCount;
      return a.name.localeCompare(b.name);
    });

    await this.firebase.updateGuildDoc(guildIdStr, {
      voiceChannels: voiceChannelsData,
    });
  }

  async processSpinRequest(
    docId: string,
    channelId: number,
    guildId: number,
    data: Record<string, unknown>,
  ): Promise<void> {
    logger.info(`Processing spin request for channel ${channelId}`);

    try {
      const guild = this.bot.get_guild(guildId);
      if (!guild) {
        logger.error(`Guild ${guildId} not found.`);
        return;
      }

      const isDebug = (data.isDebug as boolean) ?? false;
      let players: WoWPlayer[];

      if (isDebug) {
        const playersData = (data.players ?? []) as Record<string, unknown>[];
        players = playersData.map((p) => WoWPlayer.fromDict(p));
      } else {
        const channel = guild.get_channel(channelId);
        if (!channel) return;

        const members = channel.members.filter((m) => !m.bot);
        players = getPlayerList(members).filter((p) => p.hasRoles());
      }

      let groups: WoWGroup[];
      if (players.length === 0 && !isDebug) {
        groups = [];
      } else {
        groups = createMythicPlusGroups(players, isDebug, guildId);
      }

      if (this.bot.groupService) {
        this.bot.groupService.lastResults.set(guildId, {
          players: [...players],
          groups: [...groups],
        });
      }

      const groupsData = groups.map((g) => g.toDict());
      await this.firebase.updateChannelDoc(docId, {
        status: 'spinning',
        groups: groupsData,
        revealedGroups: 0,
      });
    } catch (e) {
      logger.error(`Spin request failed for channel ${channelId}: ${e}`);
      try {
        await this.firebase.updateChannelDoc(docId, {
          status: 'lobby',
          groups: [],
        });
      } catch (e2) {
        logger.error(`Failed to reset channel ${channelId} after spin error: ${e2}`);
      }
    }
  }

  async announceCompletion(
    channelId: number,
    guildId: number,
    data: Record<string, unknown>,
  ): Promise<void> {
    const guild = this.bot.get_guild(guildId);
    if (!guild) return;

    const channel = guild.get_channel(channelId);
    if (!channel) return;

    let groups: WoWGroup[] = [];
    const last = this.bot.groupService?.lastResults.get(guildId);
    if (last?.groups?.length) {
      groups = [...last.groups];
    } else {
      const groupsData = (data.groups ?? []) as Record<string, unknown>[];
      groups = groupsData.map((g) => WoWGroup.fromDict(g));
    }

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
      logger.warn(`Could not send completion embed to channel ${channelId}: ${e}`);
    }
  }

  async cleanupChannel(channelId: number): Promise<void> {
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

  private async _asyncCleanupGuildIfEmpty(guildId: number): Promise<void> {
    const guildHasChannels = [...this.activeChannels.values()].some(
      (ac) => ac.guildId === guildId,
    );
    if (!guildHasChannels) {
      this.activeGuilds.delete(guildId);
      await this.firebase.deleteGuildDoc(String(guildId));
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
    const docId = change.document.id;
    let channelId: number;
    try {
      channelId = parseInt(docId, 10);
    } catch {
      return;
    }
    if (isNaN(channelId)) return;

    const active = this.activeChannels.get(channelId);
    if (active) {
      this.activeChannels.delete(channelId);
      this.announcedChannels.delete(docId);
      if (this.channelListeners.has(docId)) {
        const watch = this.channelListeners.get(docId);
        watch?.unsubscribe();
        this.channelListeners.delete(docId);
      }
      logger.info(`Channel ${channelId} removed from tracking`);
      this._cleanupGuildIfEmpty(active.guildId);
    }
  }

  private _cleanupGuildIfEmpty(guildId: number): void {
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

  getActiveChannelIdsForGuild(guildId: number): number[] {
    return [...this.activeChannels.entries()]
      .filter(([, ac]) => ac.guildId === guildId)
      .map(([chId]) => chId);
  }
}
