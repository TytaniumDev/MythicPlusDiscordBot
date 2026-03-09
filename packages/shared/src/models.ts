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
import type { WoWGroupDict, WoWPlayerDict } from './types.js';

export class WoWPlayer {
  readonly name: string;
  readonly discordId: string;
  readonly tankMain: boolean;
  readonly healerMain: boolean;
  readonly dpsMain: boolean;
  readonly offtank: boolean;
  readonly offhealer: boolean;
  readonly offdps: boolean;
  readonly offranged: boolean;
  readonly offmelee: boolean;
  readonly ranged: boolean;
  readonly melee: boolean;
  readonly hasBrez: boolean;
  readonly hasLust: boolean;

  private constructor(params: {
    name: string;
    discordId?: string;
    tankMain?: boolean;
    healerMain?: boolean;
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
  }) {
    this.name = params.name;
    this.discordId = params.discordId ?? '';
    this.tankMain = params.tankMain ?? false;
    this.healerMain = params.healerMain ?? false;
    this.dpsMain = params.dpsMain ?? false;
    this.offtank = params.offtank ?? false;
    this.offhealer = params.offhealer ?? false;
    this.offdps = params.offdps ?? false;
    this.offranged = params.offranged ?? false;
    this.offmelee = params.offmelee ?? false;
    this.ranged = params.ranged ?? false;
    this.melee = params.melee ?? false;
    this.hasBrez = params.hasBrez ?? false;
    this.hasLust = params.hasLust ?? false;
  }

  static create(name: string, roles: string[], discordId = ''): WoWPlayer {
    const tankMain = roles.includes(ROLE_TANK);
    const healerMain = roles.includes(ROLE_HEALER);
    const ranged = roles.includes(ROLE_RANGED);
    const melee = roles.includes(ROLE_MELEE);
    const dpsMain = ranged || melee;
    const offtank = roles.includes(ROLE_TANK_OFFSPEC);
    const offhealer = roles.includes(ROLE_HEALER_OFFSPEC);
    const offranged = roles.includes(ROLE_RANGED_OFFSPEC);
    const offmelee = roles.includes(ROLE_MELEE_OFFSPEC);
    const offdps = offranged || offmelee;
    const hasBrez = roles.includes(ROLE_BREZ);
    const hasLust = roles.includes(ROLE_LUST);

    return new WoWPlayer({
      name,
      discordId,
      tankMain,
      healerMain,
      dpsMain,
      offtank,
      offhealer,
      offdps,
      offranged,
      offmelee,
      ranged,
      melee,
      hasBrez,
      hasLust,
    });
  }

  /**
   * Direct construction with explicit boolean flags.
   * Used by prebuilt test helpers and from_dict deserialization.
   */
  static fromFlags(params: {
    name: string;
    discordId?: string;
    tankMain?: boolean;
    healerMain?: boolean;
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
    return new WoWPlayer(params);
  }

  equals(other: WoWPlayer): boolean {
    return this.name === other.name;
  }

  hasRoles(): boolean {
    return (
      this.tankMain ||
      this.healerMain ||
      this.dpsMain ||
      this.offtank ||
      this.offhealer ||
      this.offdps
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
      roles: {
        tankMain: this.tankMain,
        healerMain: this.healerMain,
        dpsMain: this.dpsMain,
        offtank: this.offtank,
        offhealer: this.offhealer,
        offdps: this.offdps,
        offranged: this.offranged,
        offmelee: this.offmelee,
        ranged: this.ranged,
        melee: this.melee,
        hasBrez: this.hasBrez,
        hasLust: this.hasLust,
      },
    };
  }

  static fromDict(data: Record<string, unknown>): WoWPlayer {
    const roles = (data.roles ?? {}) as Record<string, boolean>;
    return new WoWPlayer({
      name: data.name as string,
      discordId: (data.discordId as string) ?? '',
      tankMain: roles.tankMain ?? false,
      healerMain: roles.healerMain ?? false,
      dpsMain: roles.dpsMain ?? false,
      offtank: roles.offtank ?? false,
      offhealer: roles.offhealer ?? false,
      offdps: roles.offdps ?? false,
      offranged: roles.offranged ?? false,
      offmelee: roles.offmelee ?? false,
      ranged: roles.ranged ?? false,
      melee: roles.melee ?? false,
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
