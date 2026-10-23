import { SessionService, type Bot, type Guild } from '../services/sessionService.js';
import type { CommandContext, GroupService } from '../services/groupService.js';
import { DISCORD_APPLICATION_ID } from '../core/config.js';
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
}

export type ActivityContext = Omit<GroupsContext, 'guild'> & {
  guild: Guild | null;
};

export class GroupsHandler {
  bot: Bot;
  sessionService: SessionService;
  groupService: GroupService;

  constructor(bot: Bot, groupService: GroupService, sessionService?: SessionService) {
    this.bot = bot;
    this.groupService = groupService;
    this.sessionService = sessionService ?? new SessionService(bot);
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

    let inviteUrl = 'N/A';
    if (DISCORD_APPLICATION_ID && ctx.author.voice.channel.createInvite) {
      try {
        const invite = await ctx.author.voice.channel.createInvite();
        inviteUrl = invite.url;
      } catch (e) {
        // Invite creation can fail for many benign reasons (missing perms,
        // channel type, rate limit). The lobby is still open from the voice
        // channel's activity launcher; surface to Sentry but don't break the
        // response.
        reportError(e, { tags: { handler: 'activity.createInvite' } });
      }
    }

    // Real lobbies only open inside the Discord activity, so there is no
    // browser link.
    await ctx.send(`🎮 **Join the Activity!**\n**Voice Channel Activity:** ${inviteUrl}\n`);
  }
}
