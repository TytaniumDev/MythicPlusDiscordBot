import {
  WoWGroup,
  WoWPlayer,
  createMythicPlusGroups,
  setGroupHistory,
  todayPST,
  type WoWGroupDict,
} from '@mythicplus/shared';
import { announceGroup, formatSittingOutNotice, type Sendable } from '../core/groupUi.js';
import { toLobbyMember, type DiscordMember, type TypingChannel } from '../core/utils.js';
import { getDebugPlayers } from '../core/debugFixtures.js';
import { FirebaseService } from '../core/firebaseService.js';
import { reportError } from '../core/sentry.js';

export interface CommandContext extends Sendable {
  channel: { members: DiscordMember[] } & TypingChannel;
  guild: { id: string } | null;
}

export interface GroupsData {
  players: WoWPlayer[];
  groups: WoWGroup[];
}

export class GroupService {
  private serverLocks: Map<string, boolean> = new Map();

  /**
   * Retrieves the eligible WoW players from the Discord channel. Only players
   * with a main role are grouped; the rest sit this spin out, and the channel
   * is told who and why.
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
      const members = ctx.channel.members.filter((m) => !m.bot).map(toLobbyMember);
      if (members.length === 0) {
        await ctx.send('❌ No players found in the channel.');
        return null;
      }
      const prefs = await FirebaseService.getInstance().getPreferences(
        members.map((m) => m.discordId),
      );
      const inVoice = members.map((m) => WoWPlayer.fromPreferences(m, prefs.get(m.discordId) ?? null));
      players = inVoice.filter((p) => p.mainRole !== null);
      const sittingOut = inVoice.filter((p) => p.mainRole === null);
      if (players.length > 0 && sittingOut.length > 0) {
        await ctx.send(formatSittingOutNotice(sittingOut.map((p) => p.name)));
      }
    }

    if (players.length === 0) {
      await ctx.send('❌ No players with valid roles found.');
      return null;
    }

    return players;
  }

  /** Loaded history rounds for use in _saveGroupHistory. */
  private loadedRounds: Map<string, WoWGroupDict[][]> = new Map();

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
      reportError(err, {
        tags: { handler: 'groupService.loadGroupHistory' },
        extra: { guildId },
      });
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
      const newRound = groups.map((g) => g.toDict());
      const today = todayPST();
      await firebase.saveGroupHistory(guildId, {
        date: today,
        rounds: [...existingRounds, newRound],
      });

      if (!debug) {
        await this._bumpSeasonPairs(firebase, guildId, groups);
      }
    } catch (err) {
      reportError(err, {
        tags: { handler: 'groupService.saveGroupHistory' },
        extra: { guildId },
      });
    } finally {
      this.loadedRounds.delete(guildId);
    }
  }

  /**
   * Increment per-guild season pair counts after a real spin. Counts reset
   * when the stored seasonSlug differs from the current `config/season` slug.
   * No-op when no season config has been written yet (the weekly cron hasn't
   * run).
   */
  private async _bumpSeasonPairs(
    firebase: FirebaseService,
    guildId: string,
    groups: WoWGroup[],
  ): Promise<void> {
    const config = await firebase.getSeasonConfig();
    if (!config) return;
    await firebase.bumpSeasonPairs(guildId, config.slug, groups);
  }

  async getGroupsData(
    ctx: CommandContext,
    debug = false,
  ): Promise<GroupsData | null> {
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
      await this._executeCoreWheel(ctx, ctx.channel, debug);
    } finally {
      this.serverLocks.set(guildId, false);
    }
  }

  async _executeCoreWheel(
    ctx: CommandContext,
    channel: TypingChannel,
    debug: boolean,
  ): Promise<void> {
    const result = await this.getGroupsData(ctx, debug);
    if (!result) return;

    for (let i = 0; i < result.groups.length; i++) {
      await announceGroup(ctx, channel, result.groups[i], i + 1, debug);
    }
  }
}
