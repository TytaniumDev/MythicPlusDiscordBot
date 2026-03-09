import { getPreferenceService } from '../core/preferenceService.js';
import { createRoleBoardEmbed, createRoleCheckEmbed, type PlayerRoleInfo } from '../core/roleUi.js';
import { getPlayerList, getWowName, type DiscordMember } from '../core/utils.js';

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

  async rolecheck(ctx: RolesContext): Promise<void> {
    const channel = ctx.author.voice?.channel ?? ctx.channel;
    const members = channel.members.filter((m) => !m.bot);

    if (members.length === 0) {
      await ctx.send('No members found in the channel.');
      return;
    }

    const prefSvc = getPreferenceService();
    const playerInfos: PlayerRoleInfo[] = [];

    for (const member of members) {
      const name = getWowName(member);
      const discordId = String(member.id);
      let savedRoles = prefSvc.getPreferenceSync(discordId);
      if (!savedRoles) {
        savedRoles = prefSvc.getPreferenceByNameSync(name);
      }
      if (savedRoles) {
        playerInfos.push({ name, roles: savedRoles });
      } else {
        playerInfos.push({ name, roles: ['No roles set'] });
      }
    }

    const embed = createRoleCheckEmbed(playerInfos);
    await ctx.send('', { embed });
  }

  async clearrole(ctx: RolesContext, name?: string | null): Promise<void> {
    const prefSvc = getPreferenceService();

    if (!name) {
      const wowName = getWowName(ctx.author);
      const discordId = String(ctx.author.id);
      const hadPrefs = prefSvc.getPreferenceSync(discordId) != null;
      await prefSvc.clearPreference(discordId);
      if (hadPrefs) {
        await ctx.send(`✅ Cleared your saved roles, **${wowName}**.`);
      } else {
        await ctx.send(`❌ You had no saved roles, **${wowName}**.`);
      }
    } else {
      const discordId = prefSvc.resolveDiscordId(name);
      if (discordId) {
        await prefSvc.clearPreference(discordId);
        await ctx.send(`✅ Cleared saved roles for **${name}**.`);
      } else {
        await ctx.send(`❌ No saved roles found for **${name}**.`);
      }
    }
  }
}
