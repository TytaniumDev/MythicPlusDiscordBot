import {
  STATIC_AFFIXES,
  decodeGroupHistoryRounds,
  isRecord,
  parseLobbyMembers,
  parseSeasonPairs,
  parseWoWGroupDicts,
  toSessionStatus,
} from '@mythicplus/shared';
import type { AffixDisplay, Decoded } from '@mythicplus/shared';
import type { AffixData, ChannelData, GuildData, VoiceChannel } from '../types';
import { reportError } from '../lib/sentry';

// Decoders for the Firestore docs the activity subscribes to. Each one turns a
// raw snapshot into typed data with safe defaults, and lists what it had to
// drop or default so the caller can report it. A malformed doc degrades the
// UI instead of crashing it. Wire shapes the bot also reads are validated by
// the codecs in @mythicplus/shared.

function optionalString(
  data: Record<string, unknown>,
  key: string,
  issues: string[],
): string | undefined {
  const value = data[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  issues.push(`${key}: not a string`);
  return undefined;
}

function requiredString(
  data: Record<string, unknown>,
  key: string,
  fallback: string,
  issues: string[],
): string {
  const value = data[key];
  if (typeof value === 'string') return value;
  issues.push(`${key}: ${value === undefined ? 'missing' : 'not a string'}`);
  return fallback;
}

function optionalBoolean(
  data: Record<string, unknown>,
  key: string,
  issues: string[],
): boolean | undefined {
  const value = data[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  issues.push(`${key}: not a boolean`);
  return undefined;
}

function optionalStringArray(
  data: Record<string, unknown>,
  key: string,
  issues: string[],
): string[] | undefined {
  const value = data[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    issues.push(`${key}: not an array`);
    return undefined;
  }
  const strings = value.filter((v): v is string => typeof v === 'string');
  if (strings.length < value.length) issues.push(`${key}: dropped ${value.length - strings.length} non-string entries`);
  return strings;
}

function parseVoiceChannels(raw: unknown, issues: string[]): VoiceChannel[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    issues.push('voiceChannels: not an array');
    return [];
  }
  const channels: VoiceChannel[] = [];
  raw.forEach((entry, i) => {
    if (
      isRecord(entry)
      && typeof entry.id === 'string'
      && typeof entry.name === 'string'
      && typeof entry.userCount === 'number'
    ) {
      channels.push({ id: entry.id, name: entry.name, userCount: entry.userCount });
    } else {
      issues.push(`voiceChannels[${i}]: invalid`);
    }
  });
  return channels;
}

function parseGroupHistory(raw: unknown, issues: string[]): GuildData['groupHistory'] {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw) || typeof raw.date !== 'string' || !Array.isArray(raw.rounds)) {
    issues.push('groupHistory: invalid');
    return undefined;
  }
  return { date: raw.date, rounds: decodeGroupHistoryRounds(raw.rounds) };
}

/** Decode a `guilds/{guildId}` snapshot. */
export function decodeGuildData(raw: unknown, guildId: string): Decoded<GuildData> {
  const issues: string[] = [];
  const data = isRecord(raw) ? raw : {};
  if (!isRecord(raw)) issues.push('doc: not an object');

  const seasonPairs = data.seasonPairs === undefined ? null : parseSeasonPairs(data.seasonPairs);
  if (data.seasonPairs !== undefined && seasonPairs === null) issues.push('seasonPairs: invalid');

  return {
    value: {
      guildId: requiredString(data, 'guildId', guildId, issues),
      guildName: optionalString(data, 'guildName', issues),
      guildIconUrl: optionalString(data, 'guildIconUrl', issues),
      voiceChannels: parseVoiceChannels(data.voiceChannels, issues),
      groupHistory: parseGroupHistory(data.groupHistory, issues),
      seasonPairs: seasonPairs ?? undefined,
      refreshRequest: data.refreshRequest,
      createdAt: data.createdAt,
      lastActive: data.lastActive,
    },
    issues,
  };
}

/** Decode a `channels/{channelId}` snapshot. */
export function decodeChannelData(raw: unknown, channelId: string): Decoded<ChannelData> {
  const issues: string[] = [];
  const data = isRecord(raw) ? raw : {};
  if (!isRecord(raw)) issues.push('doc: not an object');

  const status = toSessionStatus(data.status);
  if (status === null) issues.push('status: invalid');

  let members: ChannelData['members'];
  if (data.members !== undefined) {
    members = parseLobbyMembers(data.members);
    const rawCount = Array.isArray(data.members) ? data.members.length : 0;
    if (!Array.isArray(data.members)) issues.push('members: not an array');
    else if (members.length < rawCount) issues.push(`members: dropped ${rawCount - members.length} invalid entries`);
  }

  const groups = parseWoWGroupDicts(data.groups);
  issues.push(...groups.issues);

  let revealedGroups: number | undefined;
  if (typeof data.revealedGroups === 'number' && Number.isInteger(data.revealedGroups) && data.revealedGroups >= 0) {
    revealedGroups = data.revealedGroups;
  } else if (data.revealedGroups !== undefined) {
    issues.push('revealedGroups: invalid');
  }

  return {
    value: {
      channelId: requiredString(data, 'channelId', channelId, issues),
      channelName: optionalString(data, 'channelName', issues) ?? '',
      guildId: requiredString(data, 'guildId', '', issues),
      status: status ?? 'lobby',
      members,
      groups: groups.value,
      revealedGroups,
      claimedPlayers: optionalStringArray(data, 'claimedPlayers', issues),
      sittingOut: optionalStringArray(data, 'sittingOut', issues),
      staticWheel: optionalBoolean(data, 'staticWheel', issues),
      isDebug: optionalBoolean(data, 'isDebug', issues) ?? false,
      createdAt: data.createdAt,
      lastActive: data.lastActive,
    },
    issues,
  };
}

function parseAffixDisplay(raw: unknown): AffixDisplay | null {
  if (!isRecord(raw)) return null;
  const { id, name, nickname, keystoneLevel, wowheadUrl, color } = raw;
  if (
    typeof id !== 'number'
    || typeof name !== 'string'
    || (nickname !== null && typeof nickname !== 'string')
    || typeof keystoneLevel !== 'string'
    // Rendered as a link, so only accept https URLs.
    || typeof wowheadUrl !== 'string' || !wowheadUrl.startsWith('https://')
    || typeof color !== 'string'
  ) {
    return null;
  }
  return { id, name, nickname, keystoneLevel, wowheadUrl, color };
}

/**
 * Decode the `config/affixes` snapshot. Falls back to the season's static
 * affixes when none of the stored ones are usable.
 */
export function decodeAffixData(raw: unknown): Decoded<AffixData> {
  const issues: string[] = [];
  const data = isRecord(raw) ? raw : {};
  if (!isRecord(raw)) issues.push('doc: not an object');

  const rawAffixes = Array.isArray(data.affixes) ? data.affixes : [];
  if (!Array.isArray(data.affixes)) issues.push('affixes: not an array');
  const parsed = rawAffixes.map(parseAffixDisplay);
  parsed.forEach((a, i) => {
    if (a === null) issues.push(`affixes[${i}]: invalid`);
  });
  const affixes = parsed.filter((a): a is AffixDisplay => a !== null);

  return {
    value: {
      period: typeof data.period === 'number' ? data.period : 0,
      region: typeof data.region === 'string' ? data.region : 'us',
      affixes: affixes.length > 0 ? affixes : STATIC_AFFIXES,
    },
    issues,
  };
}

const reportedIssues = new Set<string>();

/**
 * Report a doc's decode issues to Sentry. Listeners re-deliver the same doc
 * on every change, so each distinct set of issues per doc is reported once.
 */
export function reportDecodeIssues(tag: string, path: string, issues: string[]): void {
  if (issues.length === 0) return;
  const key = `${path}\n${issues.join('\n')}`;
  if (reportedIssues.has(key)) return;
  reportedIssues.add(key);
  reportError(new Error(`Malformed Firestore doc ${path}: ${issues.join('; ')}`), {
    tag,
    extra: { path, issues },
  });
}
