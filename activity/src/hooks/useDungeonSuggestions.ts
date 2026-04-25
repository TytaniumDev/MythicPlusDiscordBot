import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/store';
import { fetchCharacterDungeonScores } from '../services/raiderioMythicPlus';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';
import { computeDungeonRanking } from '../lib/dungeonSuggestions';
import type { DungeonSuggestionsState } from '../lib/dungeonSuggestions';
import type { WoWPlayer } from '../types';

const DEFAULT_REGION = 'us';

interface FetchState {
  phase: 'idle' | 'loading' | 'fetched' | 'no-targets';
  /** One entry per *unique* character (by region/realm/name), in target order. */
  characters: (CharacterDungeonScores | null)[];
  /** Maps discordId → index into `characters` for the player's character. */
  characterIndexByDiscordId: Record<string, number>;
  serviceErrors: number;
  lookupTargetCount: number;
}

const IDLE_FETCH_STATE: FetchState = {
  phase: 'idle',
  characters: [],
  characterIndexByDiscordId: {},
  serviceErrors: 0,
  lookupTargetCount: 0,
};

interface PlayerTarget {
  discordId: string;
  key: string;
  name: string;
  realm: string;
  region: string;
}

interface UniqueLookup {
  key: string;
  name: string;
  realm: string;
  region: string;
}

export interface UseDungeonSuggestionsResult {
  /** The aggregated ranking + status that drives the panel UI. */
  state: DungeonSuggestionsState;
  /**
   * Per-player M+ score data keyed by Discord ID. Players without a parseable
   * `inGameName` are absent from the map; players whose lookup is in flight
   * are absent until the fetch settles. Lookup failures map to `null`.
   */
  scoresByDiscordId: ReadonlyMap<string, CharacterDungeonScores | null>;
}

function realmToSlug(realm: string): string {
  return realm
    .trim()
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseInGameName(input: string | undefined | null): { name: string; realmSlug: string } | null {
  if (!input) return null;
  const trimmed = input.trim();
  const dashIdx = trimmed.indexOf('-');
  if (dashIdx === -1) return null;
  const name = trimmed.slice(0, dashIdx).trim();
  const realm = trimmed.slice(dashIdx + 1).trim();
  if (!name || !realm) return null;
  return { name, realmSlug: realmToSlug(realm) };
}

function buildPlayerTargets(players: readonly WoWPlayer[]): PlayerTarget[] {
  const out: PlayerTarget[] = [];
  for (const p of players) {
    if (!p.discordId) continue;
    const parsed = parseInGameName(p.inGameName);
    if (!parsed) continue;
    const key = `${DEFAULT_REGION}/${parsed.realmSlug}/${parsed.name.toLowerCase()}`;
    out.push({
      discordId: p.discordId,
      key,
      name: parsed.name,
      realm: parsed.realmSlug,
      region: DEFAULT_REGION,
    });
  }
  return out;
}

function uniqueLookupsFor(playerTargets: readonly PlayerTarget[]): UniqueLookup[] {
  const seen = new Set<string>();
  const lookups: UniqueLookup[] = [];
  for (const t of playerTargets) {
    if (seen.has(t.key)) continue;
    seen.add(t.key);
    lookups.push({ key: t.key, name: t.name, realm: t.realm, region: t.region });
  }
  return lookups;
}

const EMPTY_SCORES_MAP: ReadonlyMap<string, CharacterDungeonScores | null> = new Map();

/**
 * Fetch per-character M+ dungeon scores from Raider.io and compute a
 * group-level ranking projected at `keyLevel`.
 *
 * Refetches whenever:
 *   - The roster of unique characters changes
 *   - `dungeonSuggestionsRefreshKey` in the store bumps (driven by spin start)
 *
 * Changes to `keyLevel` don't refetch — we re-aggregate the cached
 * per-character data via useMemo so flipping the dropdown is instant.
 *
 * The hook returns both the aggregated `state` (consumed by the suggestions
 * panel) and a `scoresByDiscordId` map (consumed by the spotlight portraits
 * to show per-player score tooltips). Two consumers, one fetch.
 */
export function useDungeonSuggestions(
  players: readonly WoWPlayer[],
  keyLevel: number,
): UseDungeonSuggestionsResult {
  const refreshKey = useAppStore((s) => s.dungeonSuggestionsRefreshKey);
  const [fetchState, setFetchState] = useState<FetchState>(IDLE_FETCH_STATE);

  const playerTargets = useMemo(() => buildPlayerTargets(players), [players]);
  const uniqueLookups = useMemo(() => uniqueLookupsFor(playerTargets), [playerTargets]);
  // Identity input for the fetch effect — the set of unique characters to fetch.
  const lookupsKey = useMemo(
    () => uniqueLookups.map(t => t.key).sort().join('|'),
    [uniqueLookups],
  );

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();

    if (uniqueLookups.length === 0) {
      setFetchState({ ...IDLE_FETCH_STATE, phase: 'no-targets' });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setFetchState((s) => ({ ...s, phase: 'loading', lookupTargetCount: uniqueLookups.length }));

    let cancelled = false;
    Promise.allSettled(
      uniqueLookups.map(t =>
        fetchCharacterDungeonScores(t.name, t.realm, t.region, controller.signal),
      ),
    ).then((results) => {
      if (cancelled || controller.signal.aborted) return;

      const characters: (CharacterDungeonScores | null)[] = [];
      let serviceErrors = 0;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          characters.push(r.value);
        } else {
          characters.push(null);
          serviceErrors += 1;
          console.warn('[Wheelson] Dungeon suggestions fetch failed:', r.reason);
        }
      }

      const indexByKey: Record<string, number> = {};
      uniqueLookups.forEach((l, i) => { indexByKey[l.key] = i; });

      const characterIndexByDiscordId: Record<string, number> = {};
      for (const t of playerTargets) {
        const idx = indexByKey[t.key];
        if (idx !== undefined) characterIndexByDiscordId[t.discordId] = idx;
      }

      setFetchState({
        phase: 'fetched',
        characters,
        characterIndexByDiscordId,
        serviceErrors,
        lookupTargetCount: uniqueLookups.length,
      });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // lookupsKey + refreshKey are the identity inputs; re-run on either change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupsKey, refreshKey]);

  // Re-aggregate whenever fetch state OR key level changes. Changing the
  // dropdown is a pure recomputation — no refetch.
  return useMemo<UseDungeonSuggestionsResult>(() => {
    const { phase, characters, characterIndexByDiscordId, serviceErrors, lookupTargetCount } = fetchState;

    if (phase === 'idle') {
      return {
        state: { status: 'idle', ranking: [], characterCount: 0, lookupTargetCount: 0 },
        scoresByDiscordId: EMPTY_SCORES_MAP,
      };
    }
    if (phase === 'no-targets') {
      return {
        state: { status: 'empty', ranking: [], characterCount: 0, lookupTargetCount: 0 },
        scoresByDiscordId: EMPTY_SCORES_MAP,
      };
    }
    if (phase === 'loading') {
      return {
        state: { status: 'loading', ranking: [], characterCount: 0, lookupTargetCount },
        scoresByDiscordId: EMPTY_SCORES_MAP,
      };
    }

    // phase === 'fetched'
    const valid = characters.filter((c): c is CharacterDungeonScores => c !== null);
    const ranking = computeDungeonRanking(characters, keyLevel);

    let status: DungeonSuggestionsState['status'];
    if (ranking.length > 0) {
      status = 'ready';
    } else if (serviceErrors > 0 && valid.length === 0) {
      status = 'error';
    } else {
      status = 'empty';
    }

    const scoresByDiscordId = new Map<string, CharacterDungeonScores | null>();
    for (const [discordId, idx] of Object.entries(characterIndexByDiscordId)) {
      scoresByDiscordId.set(discordId, characters[idx] ?? null);
    }

    return {
      state: {
        status,
        ranking,
        characterCount: valid.length,
        lookupTargetCount,
      },
      scoresByDiscordId,
    };
  }, [fetchState, keyLevel]);
}
