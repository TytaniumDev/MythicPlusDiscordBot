import { SessionService, type Bot, type Guild, type VoiceChannel } from '../services/sessionService.js';
import type { GroupService } from '../services/groupService.js';
import { reportBadGroup } from '../core/issues.js';
import { ACTIVITY_URL, DISCORD_APPLICATION_ID } from '../core/config.js';
import logger from '../core/logger.js';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(content: string, options?: { ephemeral?: boolean }): Promise<any>;
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

  async wheel(ctx: GroupsContext): Promise<void> {
    await ctx.defer();
    try {
      if (!ctx.channel) {
        throw new Error('Channel context is required for coreWheel');
      }
      await this.groupService.coreWheel(ctx as GroupsContext & { channel: NonNullable<GroupsContext['channel']> }, false);
    } catch (e) {
      await ctx.send('❌ An unexpected error occurred. Please try again later.');
      logger.error(`Error in wheel command: ${e}`);
    }
  }

  async activity(ctx: ActivityContext, debug = false): Promise<void> {
    await ctx.defer();
    try {
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

      let inviteUrl = 'N/A';
      if (DISCORD_APPLICATION_ID && ctx.author.voice.channel.createInvite) {
        try {
          const invite = await ctx.author.voice.channel.createInvite();
          inviteUrl = invite.url;
        } catch (e) {
          logger.warn(`Failed to create embedded invite: ${e}`);
        }
      }

      const activityUrlBase = ACTIVITY_URL;
      let msg = '🎮 **Join the Activity!**\n';
      msg += `**Voice Channel Activity:** ${inviteUrl}\n`;

      if (activityUrlBase) {
        const directLink = `${activityUrlBase}?guildId=${guildId}&channelId=${channelId}`;
        msg += `**Browser Link:** [Click Here](${directLink})\n`;
      } else {
        msg += '⚠️ `ACTIVITY_URL` not set in .env.';
      }

      await ctx.send(msg);
    } catch (e) {
      await ctx.send('❌ An unexpected error occurred. Please try again later.');
      logger.error(`Error in activity command: ${e}`);
    }
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
    try {
      const issue = await reportBadGroup({
        reporterName: ctx.author.name,
        reporterId: ctx.author.id,
        title,
        description,
        players: lastResults.players,
        groups: lastResults.groups,
      });
      await ctx.send(`✅ Bad group reported successfully: ${issue.html_url}`, { ephemeral: true });
    } catch (e) {
      logger.error(`Error creating GitHub issue via badgroup command: ${e}`);
      await ctx.send(`❌ Failed to create issue: ${e}`, { ephemeral: true });
    }
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
