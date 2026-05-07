import {
  WoWGroup,
  WoWPlayer,
  bumpPairCounts,
  createMythicPlusGroups,
  setGroupHistory,
  todayPST,
} from '@mythicplus/shared';
import { announceGroup, type Sendable } from '../core/groupUi.js';
import { getPlayerList, type DiscordMember, type TypingChannel } from '../core/utils.js';
import { getDebugPlayers } from '../core/debugFixtures.js';
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
      const members = ctx.channel.members.filter((m) => !m.bot);
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
      if (!history || history.date !== todayPST()) {
        this.loadedRounds.set(guildId, []);
        setGroupHistory([], guildId);
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
    debug: boolean,
  ): Promise<void> {
    if (!firebase.isAvailable()) return;

    try {
      const existingRounds = this.loadedRounds.get(guildId) ?? [];
      const newRound = groups.map((g) => g.toDict() as Record<string, unknown>);
      const today = todayPST();
      await firebase.saveGroupHistory(guildId, {
        date: today,
        rounds: [...existingRounds, newRound],
      });

      if (!debug) {
        await this._bumpSeasonPairs(firebase, guildId, groups);
      }
    } catch (err) {
      logger.warn(`Failed to save group history for guild ${guildId}: ${err}`);
    } finally {
      this.loadedRounds.delete(guildId);
    }
  }

  /**
   * Increment per-guild season pair counts after a real spin. Lazy-resets
   * counts when the stored seasonSlug differs from the current `config/season`
   * slug. No-op when no season config has been written yet (the weekly cron
   * hasn't run).
   */
  private async _bumpSeasonPairs(
    firebase: FirebaseService,
    guildId: string,
    groups: WoWGroup[],
  ): Promise<void> {
    const config = await firebase.getSeasonConfig();
    if (!config) return;
    const existing = await firebase.getSeasonPairs(guildId);
    const baseCounts =
      existing && existing.seasonSlug === config.slug ? existing.counts : {};
    const counts = bumpPairCounts(baseCounts, groups);
    await firebase.saveSeasonPairs(guildId, { seasonSlug: config.slug, counts });
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
      await this._saveGroupHistory(firebase, guildId, groups, debug);
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
