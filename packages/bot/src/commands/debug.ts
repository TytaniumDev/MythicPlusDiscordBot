import type { GroupService, CommandContext } from '../services/groupService.js';
import logger from '../core/logger.js';

export interface DebugContext extends CommandContext {
  channel: CommandContext['channel'] & {
    send(content: string): Promise<unknown>;
  };
}

export class DebugHandler {
  private groupService: GroupService;

  constructor(groupService: GroupService) {
    this.groupService = groupService;
  }

  async test(ctx: DebugContext): Promise<void> {
    try {
      await this.groupService.coreWheel(ctx, true);
    } catch (e) {
      await ctx.send('❌ An unexpected error occurred. Please try again later.');
      logger.error(`Error in test command: ${e}`);
    }
  }

  async testcase(ctx: DebugContext): Promise<void> {
    try {
      const guildId = ctx.guild?.id ?? null;
      if (!guildId) {
        await ctx.send('❌ This command can only be used in a server.');
        return;
      }

      const result = this.groupService.lastResults.get(guildId);
      if (!result) {
        await ctx.send('❌ No previous results found for this server. Run `!wheel` first.');
        return;
      }
      const { players, groups } = result;

      await ctx.channel.send(
        `players = [${players.map((p) => p.toTestString()).join(', ')}]`,
      );
      await ctx.channel.send(
        `Groups:\n\n${groups.map((g) => g.toTestString()).join('\n\n')}`,
      );
    } catch (e) {
      await ctx.send('❌ An unexpected error occurred. Please try again later.');
      logger.error(`Error in testcase command: ${e}`);
    }
  }
}
