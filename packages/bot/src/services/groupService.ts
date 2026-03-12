import { WoWGroup, WoWPlayer, createMythicPlusGroups } from '@mythicplus/shared';
import { announceGroup, type Sendable } from '../core/groupUi.js';
import { getDebugPlayers, getPlayerList, type DiscordMember, type TypingChannel } from '../core/utils.js';

export interface CommandContext extends Sendable {
  channel: { members: DiscordMember[] } & TypingChannel;
  guild: { id: number } | null;
  authorId?: string;
}

export interface LastResults {
  players: WoWPlayer[];
  groups: WoWGroup[];
}

export class GroupService {
  lastResults: Map<number, LastResults> = new Map();
  private serverLocks: Map<number, boolean> = new Map();

  async getGroupsData(
    ctx: CommandContext,
    debug = false,
  ): Promise<LastResults | null> {
    let players: WoWPlayer[];

    if (debug) {
      players = getDebugPlayers();
    } else {
      const members = ctx.channel.members.filter(
        (m) => !(m as unknown as { bot: boolean }).bot,
      );
      if (members.length === 0) {
        await ctx.send('❌ No players found in the channel.');
        return null;
      }
      players = getPlayerList(members).filter((p) => p.hasRoles());
    }

    if (players.length === 0) {
      await ctx.send('❌ No players with valid roles found.');
      return null;
    }

    const guildId = ctx.guild?.id ?? null;
    const groups = createMythicPlusGroups(players, debug, guildId);

    return { players: [...players], groups: [...groups] };
  }

  async coreWheel(
    ctx: CommandContext,
    debugValue: boolean | null = null,
  ): Promise<void> {
    const debug = debugValue ?? false;
    const guildId = ctx.guild?.id ?? null;

    if (!guildId) {
      return;
    }

    if (this.serverLocks.get(guildId)) {
      return;
    }

    this.serverLocks.set(guildId, true);
    try {
      await this._executeCoreWheel(ctx, ctx.channel, guildId, debug);
    } finally {
      this.serverLocks.set(guildId, false);
    }
  }

  async _executeCoreWheel(
    ctx: CommandContext,
    channel: TypingChannel,
    guildId: number,
    debug: boolean,
  ): Promise<void> {
    const result = await this.getGroupsData(ctx, debug);
    if (!result) return;

    this.lastResults.set(guildId, result);

    for (let i = 0; i < result.groups.length; i++) {
      await announceGroup(ctx, channel, result.groups[i], i + 1, debug, ctx.authorId);
    }
  }
}
