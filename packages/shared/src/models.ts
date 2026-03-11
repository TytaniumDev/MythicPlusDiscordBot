import {
  ROLE_BREZ,
  ROLE_HEALER,
  ROLE_HEALER_OFFSPEC,
  ROLE_LUST,
  ROLE_MELEE,
  ROLE_MELEE_OFFSPEC,
  ROLE_RANGED,
  ROLE_RANGED_OFFSPEC,
  ROLE_TANK,
  ROLE_TANK_OFFSPEC,
} from './config.js';
import type { Role, Utility, WoWGroupDict, WoWPlayerDict } from './types.js';

export class WoWPlayer {
  readonly name: string;
  readonly discordId: string;
  readonly inGameName: string;
  readonly mainRole: Role | null;
  readonly offspecs: readonly Role[];
  readonly utilities: readonly Utility[];

  private constructor(
    name: string,
    discordId: string,
    mainRole: Role | null,
    offspecs: readonly Role[],
    utilities: readonly Utility[],
    inGameName = '',
  ) {
    this.name = name;
    this.discordId = discordId;
    this.inGameName = inGameName;
    this.mainRole = mainRole;
    this.offspecs = offspecs;
    this.utilities = utilities;
  }

  // Computed boolean getters — algorithm uses these, no algorithm changes needed
  get tankMain(): boolean {
    return this.mainRole === 'tank';
  }
  get healerMain(): boolean {
    return this.mainRole === 'healer';
  }
  get dpsMain(): boolean {
    return this.mainRole === 'ranged' || this.mainRole === 'melee';
  }
  get offtank(): boolean {
    return this.offspecs.includes('tank');
  }
  get offhealer(): boolean {
    return this.offspecs.includes('healer');
  }
  get offdps(): boolean {
    return this.offspecs.includes('ranged') || this.offspecs.includes('melee');
  }
  get offranged(): boolean {
    return this.offspecs.includes('ranged');
  }
  get offmelee(): boolean {
    return this.offspecs.includes('melee');
  }
  get ranged(): boolean {
    return this.mainRole === 'ranged';
  }
  get melee(): boolean {
    return this.mainRole === 'melee';
  }
  get hasBrez(): boolean {
    return this.utilities.includes('brez');
  }
  get hasLust(): boolean {
    return this.utilities.includes('lust');
  }
  get inviteName(): string {
    return this.inGameName || this.name;
  }

  static create(name: string, roles: string[], discordId = '', inGameName = ''): WoWPlayer {
    const isTank = roles.includes(ROLE_TANK);
    const isHealer = roles.includes(ROLE_HEALER);
    const isRanged = roles.includes(ROLE_RANGED);
    const isMelee = roles.includes(ROLE_MELEE);

    const mainRole: Role | null = isTank
      ? 'tank'
      : isHealer
        ? 'healer'
        : isRanged
          ? 'ranged'
          : isMelee
            ? 'melee'
            : null;

    const offspecs: Role[] = [];
    if (roles.includes(ROLE_TANK_OFFSPEC)) offspecs.push('tank');
    if (roles.includes(ROLE_HEALER_OFFSPEC)) offspecs.push('healer');
    if (roles.includes(ROLE_RANGED_OFFSPEC)) offspecs.push('ranged');
    if (roles.includes(ROLE_MELEE_OFFSPEC)) offspecs.push('melee');

    const utilities: Utility[] = [];
    if (roles.includes(ROLE_BREZ)) utilities.push('brez');
    if (roles.includes(ROLE_LUST)) utilities.push('lust');

    return new WoWPlayer(name, discordId, mainRole, offspecs, utilities, inGameName);
  }

  /**
   * Direct construction with explicit boolean flags.
   * Used by prebuilt test helpers. Internally derives the enum-based representation.
   */
  static fromFlags(params: {
    name: string;
    discordId?: string;
    inGameName?: string;
    tankMain?: boolean;
    healerMain?: boolean;
    /** @deprecated Redundant — use `ranged` or `melee` instead. Accepted for backward compat. */
    dpsMain?: boolean;
    offtank?: boolean;
    offhealer?: boolean;
    offdps?: boolean;
    offranged?: boolean;
    offmelee?: boolean;
    ranged?: boolean;
    melee?: boolean;
    hasBrez?: boolean;
    hasLust?: boolean;
  }): WoWPlayer {
    const tankMain = params.tankMain ?? false;
    const healerMain = params.healerMain ?? false;
    const ranged = params.ranged ?? false;
    const melee = params.melee ?? false;

    const mainRole: Role | null = tankMain
      ? 'tank'
      : healerMain
        ? 'healer'
        : ranged
          ? 'ranged'
          : melee
            ? 'melee'
            : null;

    const offspecs: Role[] = [];
    if (params.offtank ?? false) offspecs.push('tank');
    if (params.offhealer ?? false) offspecs.push('healer');
    if (params.offranged ?? false) offspecs.push('ranged');
    if (params.offmelee ?? false) offspecs.push('melee');
    // offdps shorthand: adds 'melee' offspec if no specific DPS offspec was set
    if ((params.offdps ?? false) && !offspecs.includes('ranged') && !offspecs.includes('melee')) {
      offspecs.push('melee');
    }

    const utilities: Utility[] = [];
    if (params.hasBrez ?? false) utilities.push('brez');
    if (params.hasLust ?? false) utilities.push('lust');

    return new WoWPlayer(
      params.name,
      params.discordId ?? '',
      mainRole,
      offspecs,
      utilities,
      params.inGameName ?? '',
    );
  }

  equals(other: WoWPlayer): boolean {
    return this.name === other.name;
  }

  hasRoles(): boolean {
    return (
      this.mainRole !== null || this.offspecs.length > 0
    );
  }

  toTestString(): string {
    const roles: string[] = [];
    if (this.tankMain) roles.push(ROLE_TANK);
    if (this.healerMain) roles.push(ROLE_HEALER);
    if (this.ranged) roles.push(ROLE_RANGED);
    if (this.melee) roles.push(ROLE_MELEE);
    if (this.offtank) roles.push(ROLE_TANK_OFFSPEC);
    if (this.offhealer) roles.push(ROLE_HEALER_OFFSPEC);
    if (this.offranged) roles.push(ROLE_RANGED_OFFSPEC);
    if (this.offmelee) roles.push(ROLE_MELEE_OFFSPEC);
    if (this.hasBrez) roles.push(ROLE_BREZ);
    if (this.hasLust) roles.push(ROLE_LUST);
    return `WoWPlayer.create("${this.name}", [${roles.map((r) => `"${r}"`).join(', ')}])`;
  }

  toUtilitiesString(): string {
    const utilities: string[] = [];
    if (this.hasBrez) utilities.push(ROLE_BREZ);
    if (this.hasLust) utilities.push(ROLE_LUST);
    if (utilities.length > 0) {
      return `${this.name}(${utilities.join(', ')})`;
    }
    return this.name;
  }

  toString(): string {
    return this.name;
  }

  toDict(): WoWPlayerDict {
    return {
      name: this.name,
      discordId: this.discordId,
      inGameName: this.inGameName,
      mainRole: this.mainRole,
      offspecs: [...this.offspecs],
      utilities: [...this.utilities],
    };
  }

  static fromDict(data: WoWPlayerDict | Record<string, unknown>): WoWPlayer {
    const name = data.name as string;
    const discordId = (data.discordId as string) ?? '';
    const inGameName = (data.inGameName as string) ?? '';

    // New compact format: mainRole/offspecs/utilities
    if ('mainRole' in data || 'offspecs' in data || 'utilities' in data) {
      const mainRole = (data.mainRole as Role | null) ?? null;
      const offspecs = (data.offspecs as Role[]) ?? [];
      const utilities = (data.utilities as Utility[]) ?? [];
      return new WoWPlayer(name, discordId, mainRole, offspecs, utilities, inGameName);
    }

    // Legacy format: nested roles object with boolean flags
    const roles = (data.roles ?? {}) as Record<string, boolean>;
    return WoWPlayer.fromFlags({
      name,
      discordId,
      inGameName,
      tankMain: roles.tankMain ?? false,
      healerMain: roles.healerMain ?? false,
      ranged: roles.ranged ?? false,
      melee: roles.melee ?? false,
      offtank: roles.offtank ?? false,
      offhealer: roles.offhealer ?? false,
      offranged: roles.offranged ?? false,
      offmelee: roles.offmelee ?? false,
      hasBrez: roles.hasBrez ?? false,
      hasLust: roles.hasLust ?? false,
    });
  }
}

export class WoWGroup {
  tank: WoWPlayer | null;
  healer: WoWPlayer | null;
  dps: WoWPlayer[];

  constructor(
    tank: WoWPlayer | null = null,
    healer: WoWPlayer | null = null,
    dps: WoWPlayer[] = [],
  ) {
    this.tank = tank;
    this.healer = healer;
    this.dps = dps;
  }

  get hasBrez(): boolean {
    return this.players.some((p) => p.hasBrez);
  }

  get hasLust(): boolean {
    return this.players.some((p) => p.hasLust);
  }

  get hasRanged(): boolean {
    return this.players.some((p) => p.ranged);
  }

  get isComplete(): boolean {
    return this.tank !== null && this.healer !== null && this.dps.length === 3;
  }

  get size(): number {
    return this.players.length;
  }

  get players(): WoWPlayer[] {
    const all: WoWPlayer[] = [];
    if (this.tank) all.push(this.tank);
    if (this.healer) all.push(this.healer);
    all.push(...this.dps);
    return all;
  }

  toTestString(): string {
    const tankStr = this.tank ? `"${this.tank.toUtilitiesString()}"` : 'None';
    const healerStr = this.healer ? `"${this.healer.toUtilitiesString()}"` : 'None';
    const dpsStr = this.dps.map((p) => `"${p.toUtilitiesString()}"`).join(', ');
    return `WoWGroup(Tank=${tankStr}, Healer=${healerStr}, DPS=${dpsStr})`;
  }

  toDict(): WoWGroupDict {
    return {
      tank: this.tank?.toDict() ?? null,
      healer: this.healer?.toDict() ?? null,
      dps: this.dps.map((p) => p.toDict()),
    };
  }

  static fromDict(data: Record<string, unknown>): WoWGroup {
    const tankData = data.tank as Record<string, unknown> | null;
    const healerData = data.healer as Record<string, unknown> | null;
    const dpsData = (data.dps ?? []) as Record<string, unknown>[];
    return new WoWGroup(
      tankData ? WoWPlayer.fromDict(tankData) : null,
      healerData ? WoWPlayer.fromDict(healerData) : null,
      dpsData.map((p) => WoWPlayer.fromDict(p)),
    );
  }
}
