import { WoWGroup, WoWPlayer, createMythicPlusGroups, setGroupHistory } from '@mythicplus/shared';
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

  /** Loaded history rounds for use in _saveGroupHistory. */
  private loadedRounds: Map<string, Record<string, unknown>[][]> = new Map();

  private async _loadGroupHistory(
    firebase: FirebaseService,
    guildId: string,
  ): Promise<void> {
    if (!firebase.isAvailable()) return;

    try {
      const history = await firebase.getGroupHistory(guildId);
      if (!history) {
        this.loadedRounds.set(guildId, []);
        return;
      }

      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      if (history.date !== today) {
        this.loadedRounds.set(guildId, []);
        return;
      }

      this.loadedRounds.set(guildId, history.rounds);
      const rounds = history.rounds.map((round) =>
        round.map((g) => WoWGroup.fromDict(g)),
      );
      setGroupHistory(rounds, guildId);
    } catch (err) {
      logger.warn(`Failed to load group history for guild ${guildId}: ${err}`);
    }
  }

  private async _saveGroupHistory(
    firebase: FirebaseService,
    guildId: string,
    groups: WoWGroup[],
  ): Promise<void> {
    if (!firebase.isAvailable()) return;

    try {
      const existingRounds = this.loadedRounds.get(guildId) ?? [];
      const newRound = groups.map((g) => g.toDict() as Record<string, unknown>);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      await firebase.saveGroupHistory(guildId, {
        date: today,
        rounds: [...existingRounds, newRound],
      });
    } catch (err) {
      logger.warn(`Failed to save group history for guild ${guildId}: ${err}`);
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
      await this._loadGroupHistory(firebase, guildId);
    }

    const groups = createMythicPlusGroups(players, debug, guildId);

    if (guildId && firebase) {
      await this._saveGroupHistory(firebase, guildId, groups);
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
