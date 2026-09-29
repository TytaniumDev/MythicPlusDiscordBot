import { WoWPlayer } from './models.js';
import type { WoWGroupDict, WoWPlayerDict } from './types.js';

/**
 * A value decoded from Firestore, plus a description of each malformed part
 * that was dropped or replaced with a default. Callers decide whether to
 * report the issues; the value is always safe to use.
 */
export interface Decoded<T> {
  value: T;
  issues: string[];
}

export function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

/**
 * Validate one player dict from the wire format. Returns null when it has no
 * usable name. Otherwise it is normalized through `WoWPlayer.fromDict`, so
 * legacy role shapes come out in the current compact shape.
 */
export function parseWoWPlayerDict(raw: unknown): WoWPlayerDict | null {
  if (!isRecord(raw) || typeof raw.name !== 'string' || raw.name === '') return null;
  return WoWPlayer.fromDict(raw).toDict();
}

function parseWoWGroupDict(raw: unknown, label: string, issues: string[]): WoWGroupDict | null {
  if (!isRecord(raw)) {
    issues.push(`${label}: not an object`);
    return null;
  }
  const slot = (value: unknown, slotLabel: string): WoWPlayerDict | null => {
    if (value === null || value === undefined) return null;
    const player = parseWoWPlayerDict(value);
    if (!player) issues.push(`${label} ${slotLabel}: invalid player`);
    return player;
  };
  let dpsRaw: unknown[] = [];
  if (Array.isArray(raw.dps)) {
    dpsRaw = raw.dps;
  } else if (raw.dps !== undefined && raw.dps !== null) {
    issues.push(`${label} dps: not an array`);
  }
  return {
    tank: slot(raw.tank, 'tank'),
    healer: slot(raw.healer, 'healer'),
    dps: dpsRaw
      .map((p, i) => slot(p, `dps ${i}`))
      .filter((p): p is WoWPlayerDict => p !== null),
  };
}

/**
 * Validate an array of group dicts (a lobby's `groups`, or one round of group
 * history). Malformed groups and players are dropped. A missing value decodes
 * to no groups without an issue.
 */
export function parseWoWGroupDicts(raw: unknown, label = 'groups'): Decoded<WoWGroupDict[]> {
  const issues: string[] = [];
  if (raw === undefined || raw === null) return { value: [], issues };
  if (!Array.isArray(raw)) return { value: [], issues: [`${label}: not an array`] };
  const value = raw
    .map((g, i) => parseWoWGroupDict(g, `${label}[${i}]`, issues))
    .filter((g): g is WoWGroupDict => g !== null);
  return { value, issues };
}
