import { SessionService, type Bot, type Guild } from '../services/sessionService.js';
import type { CommandContext, GroupService } from '../services/groupService.js';
import { reportBadGroup } from '../core/issues.js';
import { ACTIVITY_URL, DISCORD_APPLICATION_ID } from '../core/config.js';
import { reportError } from '../core/sentry.js';

export interface GroupsContext {
  guild: { id: string } | null;
  author: {
    id: string;
    name: string;
    voice?: {
      channel?: {
        id: string;
        name: string;
        members?: { bot: boolean }[];
        createInvite?(): Promise<{ url: string }>;
      } | null;
    } | null;
  };
  channel?: {
    members: { bot: boolean; id: string; toString(): string }[];
    sendTyping(): Promise<void>;
  };
  send(content: string, options?: { ephemeral?: boolean }): Promise<unknown>;
  defer(options?: { ephemeral?: boolean }): Promise<void>;
  interaction?: { response: { sendModal(modal: unknown): Promise<void> } } | null;
}

export type ActivityContext = Omit<GroupsContext, 'guild'> & {
  guild: Guild | null;
};

export interface VoiceState {
  channel: { id: string; members: { bot: boolean }[] } | null;
}

export class GroupsHandler {
  bot: Bot;
  sessionService: SessionService;
  groupService: GroupService;

  constructor(bot: Bot, groupService: GroupService, sessionService?: SessionService) {
    this.bot = bot;
    this.groupService = groupService;
    this.sessionService = sessionService ?? new SessionService(bot);
  }

  /**
   * Attempts to generate a Discord invite URL for the user's current voice channel.
   * Fails gracefully if permissions, channel type, or rate limits prevent creation.
   *
   * @param voiceChannel - The voice channel object from the context
   * @returns A string containing the URL, or 'N/A' if it could not be created
   */
  private async _generateInviteUrl(
    voiceChannel: NonNullable<ActivityContext['author']['voice']>['channel'],
  ): Promise<string> {
    if (!DISCORD_APPLICATION_ID || !voiceChannel?.createInvite) {
      return 'N/A';
    }

    try {
      const invite = await voiceChannel.createInvite();
      return invite.url;
    } catch (e) {
      // Invite creation can fail for many benign reasons (missing perms,
      // channel type, rate limit). The activity link still works without
      // it; surface to Sentry but don't break the response.
      reportError(e, { tags: { handler: 'activity.createInvite' } });
      return 'N/A';
    }
  }

  /**
   * Formats the response message for the /activity command.
   *
   * @param inviteUrl - The URL to join the Discord voice channel
   * @param guildId - The ID of the Discord guild
   * @param channelId - The ID of the Discord channel
   * @returns The formatted markdown string to be sent to the channel
   */
  private _buildActivityMessage(
    inviteUrl: string,
    guildId: string,
    channelId: string,
  ): string {
    let msg = '🎮 **Join the Activity!**\n';
    msg += `**Voice Channel Activity:** ${inviteUrl}\n`;

    if (ACTIVITY_URL) {
      const directLink = `${ACTIVITY_URL}?guildId=${guildId}&channelId=${channelId}`;
      msg += `**Browser Link:** [Click Here](${directLink})\n`;
    } else {
      msg += '⚠️ `ACTIVITY_URL` not set in .env.';
    }

    return msg;
  }

  // Errors propagate to the InteractionCreate wrapper in main.ts, which
  // reports to Sentry with command/guild tags and replies with a generic
  // ephemeral error message. Catching here would prevent that.
  async wheel(ctx: GroupsContext): Promise<void> {
    await ctx.defer();
    if (!ctx.channel) {
      throw new Error('Channel context is required for coreWheel');
    }
    await this.groupService.coreWheel(ctx as unknown as CommandContext, false);
  }

  async activity(ctx: ActivityContext, debug = false): Promise<void> {
    await ctx.defer();
    if (!ctx.author.voice?.channel) {
      await ctx.send('❌ You must be in a voice channel to start an activity.');
      return;
    }

    const result = await this.sessionService.getOrCreateSession(ctx, debug);
    if (!result) {
      await ctx.send('❌ Failed to create/get session. Is Firebase configured?');
      return;
    }

    const [guildId, channelId] = result;

    const inviteUrl = await this._generateInviteUrl(ctx.author.voice.channel);
    const msg = this._buildActivityMessage(inviteUrl, guildId, channelId);

    await ctx.send(msg);
  }

  async badgroup(
    ctx: GroupsContext,
    title?: string | null,
    description?: string | null,
  ): Promise<void> {
    const guildId = ctx.guild?.id ?? null;
    const lastResults = guildId ? this.groupService.lastResults.get(guildId) : undefined;
    if (!lastResults) {
      await ctx.send(
        '❌ No group creation data found for this server. Run /wheel first.',
        { ephemeral: true },
      );
      return;
    }

    // If slash command without arguments, send modal
    if (ctx.interaction && title == null) {
      // In actual discord.js: ctx.interaction.response.sendModal(...)
      await ctx.interaction.response.sendModal(lastResults);
      return;
    }

    if (!title || !description) {
      await ctx.send(
        '❌ Please provide both a title and a description when using the prefix command. ' +
          'Usage: `!badgroup "Title" Description` or use `/badgroup` to open a modal.',
        { ephemeral: true },
      );
      return;
    }

    await ctx.defer({ ephemeral: true });
    const issue = await reportBadGroup({
      reporterName: ctx.author.name,
      reporterId: ctx.author.id,
      title,
      description,
      players: lastResults.players,
      groups: lastResults.groups,
    });
    await ctx.send(`✅ Bad group reported successfully: ${issue.html_url}`, { ephemeral: true });
  }

  async onVoiceStateUpdate(
    member: { bot: boolean; guild: Guild },
    before: VoiceState,
    after: VoiceState,
  ): Promise<void> {
    if (before.channel?.id === after.channel?.id) return;

    if (before.channel && this.sessionService.activeChannels.has(before.channel.id)) {
      const humans = before.channel.members.filter((m) => !m.bot);
      if (humans.length === 0) {
        await this.sessionService.cleanupChannel(before.channel.id);
      } else {
        await this.sessionService.updateChannelPlayers(before.channel.id, member.guild);
      }
    }

    if (after.channel && this.sessionService.activeChannels.has(after.channel.id)) {
      await this.sessionService.updateChannelPlayers(after.channel.id, member.guild);
    }
  }
}
