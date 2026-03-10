import { createRoleBoardEmbed } from '../core/roleUi.js';
import { getPlayerList, type DiscordMember } from '../core/utils.js';

export interface RolesContext {
  guild: { id: number } | null;
  author: DiscordMember & {
    id: string | number;
    voice?: { channel?: { id: number; members: (DiscordMember & { bot: boolean })[] } | null } | null;
  };
  channel: { members: (DiscordMember & { bot: boolean })[] };
  send(content: string, options?: Record<string, unknown>): Promise<unknown>;
  interaction?: unknown;
}

export class RolesHandler {
  async launchRoleBoard(ctx: RolesContext): Promise<void> {
    if (!ctx.guild) {
      await ctx.send('❌ This command can only be used in a server.');
      return;
    }

    const targetChannel = ctx.author.voice?.channel ?? ctx.channel;
    const members = targetChannel.members.filter((m) => !m.bot);
    const players = getPlayerList(members);
    const embed = createRoleBoardEmbed(players);

    // In real discord.js, also create an ActionRow with buttons
    await ctx.send('', { embed, view: 'role_board' });
  }

}
