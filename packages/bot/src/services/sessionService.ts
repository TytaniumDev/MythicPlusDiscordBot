import { FirebaseService } from '../core/firebaseService.js';
import type { DiscordMember } from '../core/utils.js';
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

/**
 * Opens lobbies for `/wheelson`. The lobby's `members` come from the people
 * with its activity open, which the `syncLobbyMembers` Cloud Function writes;
 * the bot no longer follows voice channels for it.
 */
export class SessionService {
  bot: Bot;
  firebase: FirebaseService;

  constructor(bot: Bot, firebase?: FirebaseService) {
    this.bot = bot;
    this.firebase = firebase ?? FirebaseService.getInstance();
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
}
