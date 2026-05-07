import type { GroupService, CommandContext } from '../services/groupService.js';
import { reportError } from '../core/sentry.js';

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
      reportError(e, { tags: { handler: 'debug.test' } });
    }
  }

}
