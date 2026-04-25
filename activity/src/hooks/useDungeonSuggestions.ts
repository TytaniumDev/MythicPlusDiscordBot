import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/store';
import { fetchCharacterDungeonScores } from '../services/raiderioMythicPlus';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';
import { computeDungeonRanking } from '../lib/dungeonSuggestions';
import type { DungeonSuggestionsState } from '../lib/dungeonSuggestions';
import type { WoWPlayer } from '../types';

const DEFAULT_REGION = 'us';

interface FetchState {
  // The "fetch-side" status. The visible status that the consumer sees is
  // derived below — it can promote to 'error' or stay 'empty' depending on
  // whether the ranking is computable.
  phase: 'idle' | 'loading' | 'fetched' | 'no-targets';
  characters: (CharacterDungeonScores | null)[];
  serviceErrors: number;
  lookupTargetCount: number;
}

const IDLE_FETCH_STATE: FetchState = {
  phase: 'idle',
  characters: [],
  serviceErrors: 0,
  lookupTargetCount: 0,
};

interface LookupTarget {
  key: string;
  name: string;
  realm: string;
  region: string;
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

function buildLookupTargets(players: readonly WoWPlayer[]): LookupTarget[] {
  const seen = new Set<string>();
  const targets: LookupTarget[] = [];
  for (const p of players) {
    const parsed = parseInGameName(p.inGameName);
    if (!parsed) continue;
    const key = `${DEFAULT_REGION}/${parsed.realmSlug}/${parsed.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ key, name: parsed.name, realm: parsed.realmSlug, region: DEFAULT_REGION });
  }
  return targets;
}

/**
 * Fetch per-character M+ dungeon scores from Raider.io and compute a
 * group-level ranking projected at `keyLevel`.
 *
 * Refetches whenever:
 *   - The roster changes (new players, new linked characters)
 *   - `dungeonSuggestionsRefreshKey` in the store bumps (driven by spin start)
 *
 * Changes to `keyLevel` don't refetch — we re-aggregate the cached
 * per-character data via useMemo so changing the dropdown is instant.
 *
 * Players without a parseable `inGameName` (e.g. "Tytanium-Stormrage")
 * are skipped — the result reflects whoever has linkable characters.
 */
export function useDungeonSuggestions(
  players: readonly WoWPlayer[],
  keyLevel: number,
): DungeonSuggestionsState {
  const refreshKey = useAppStore((s) => s.dungeonSuggestionsRefreshKey);
  const [fetchState, setFetchState] = useState<FetchState>(IDLE_FETCH_STATE);

  const targets = useMemo(() => buildLookupTargets(players), [players]);
  const playersKey = useMemo(() => targets.map(t => t.key).sort().join('|'), [targets]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();

    if (targets.length === 0) {
      setFetchState({ ...IDLE_FETCH_STATE, phase: 'no-targets' });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setFetchState((s) => ({ ...s, phase: 'loading', lookupTargetCount: targets.length }));

    let cancelled = false;
    Promise.allSettled(
      targets.map(t =>
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

      setFetchState({
        phase: 'fetched',
        characters,
        serviceErrors,
        lookupTargetCount: targets.length,
      });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // playersKey + refreshKey are the identity inputs; re-run on either change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playersKey, refreshKey]);

  // Re-aggregate whenever fetch state OR key level changes. Changing the
  // dropdown is a pure recomputation — no refetch.
  return useMemo<DungeonSuggestionsState>(() => {
    const { phase, characters, serviceErrors, lookupTargetCount } = fetchState;

    if (phase === 'idle') {
      return { status: 'idle', ranking: [], characterCount: 0, lookupTargetCount: 0 };
    }
    if (phase === 'no-targets') {
      return { status: 'empty', ranking: [], characterCount: 0, lookupTargetCount: 0 };
    }
    if (phase === 'loading') {
      return { status: 'loading', ranking: [], characterCount: 0, lookupTargetCount };
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

    return {
      status,
      ranking,
      characterCount: valid.length,
      lookupTargetCount,
    };
  }, [fetchState, keyLevel]);
}
