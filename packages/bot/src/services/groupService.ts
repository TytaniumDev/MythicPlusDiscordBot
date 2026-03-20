import { WoWGroup, WoWPlayer, createMythicPlusGroups, setLastGroups } from '@mythicplus/shared';
import { announceGroup, type Sendable } from '../core/groupUi.js';
import { getDebugPlayers, getPlayerList, type DiscordMember, type TypingChannel } from '../core/utils.js';
import { FirebaseService } from '../core/firebaseService.js';
import logger from '../core/logger.js';

export interface CommandContext extends Sendable {
  channel: { members: DiscordMember[] } & TypingChannel;
  guild: { id: string } | null;
}

export interface LastResults {
  players: WoWPlayer[];
  groups: WoWGroup[];
}

export class GroupService {
  lastResults: Map<string, LastResults> = new Map();
  private serverLocks: Map<string, boolean> = new Map();

  /**
   * Retrieves the eligible WoW players from the Discord channel.
   *
   * @param ctx - The command context.
   * @param debug - Whether to use debug data.
   * @returns An array of WoW players or null if none are found.
   */
  private async _getEligiblePlayers(
    ctx: CommandContext,
    debug: boolean,
  ): Promise<WoWPlayer[] | null> {
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

    return players;
  }

  /**
   * Loads the previous groups from Firestore for a given guild ID.
   *
   * @param firebase - The Firebase service instance.
   * @param guildId - The Discord guild ID.
   */
  private async _loadPreviousGroups(
    firebase: FirebaseService,
    guildId: string,
  ): Promise<void> {
    if (!firebase.isAvailable()) return;

    try {
      const prevGroupDicts = await firebase.getPreviousGroups(guildId);
      if (prevGroupDicts.length > 0) {
        const previousGroups = prevGroupDicts.map((g) => WoWGroup.fromDict(g));
        setLastGroups(previousGroups, guildId);
      }
    } catch (err) {
      logger.warn(`Failed to load previous groups for guild ${guildId}: ${err}`);
    }
  }

  /**
   * Saves the newly generated groups to Firestore.
   *
   * @param firebase - The Firebase service instance.
   * @param guildId - The Discord guild ID.
   * @param groups - The array of created WoW groups.
   */
  private async _savePreviousGroups(
    firebase: FirebaseService,
    guildId: string,
    groups: WoWGroup[],
  ): Promise<void> {
    if (!firebase.isAvailable()) return;

    try {
      await firebase.savePreviousGroups(
        guildId,
        groups.map((g) => g.toDict() as Record<string, unknown>),
      );
    } catch (err) {
      logger.warn(`Failed to save previous groups for guild ${guildId}: ${err}`);
    }
  }

  async getGroupsData(
    ctx: CommandContext,
    debug = false,
  ): Promise<LastResults | null> {
    const players = await this._getEligiblePlayers(ctx, debug);
    if (!players) {
      return null;
    }

    const guildId = ctx.guild?.id ?? null;
    const firebase = guildId ? FirebaseService.getInstance() : null;

    if (guildId && firebase) {
      await this._loadPreviousGroups(firebase, guildId);
    }

    const groups = createMythicPlusGroups(players, debug, guildId);

    if (guildId && firebase) {
      await this._savePreviousGroups(firebase, guildId, groups);
    }

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
    guildId: string,
    debug: boolean,
  ): Promise<void> {
    const result = await this.getGroupsData(ctx, debug);
    if (!result) return;

    this.lastResults.set(guildId, result);

    for (let i = 0; i < result.groups.length; i++) {
      await announceGroup(ctx, channel, result.groups[i], i + 1, debug);
    }
  }
}
