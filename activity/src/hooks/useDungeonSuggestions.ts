import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/store';
import { fetchCharacterDungeonScores } from '../services/raiderioMythicPlus';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';
import { computeDungeonRanking } from '../lib/dungeonSuggestions';
import type { DungeonSuggestionsState } from '../lib/dungeonSuggestions';
import type { WoWPlayer } from '../types';

const DEFAULT_REGION = 'us';

const IDLE_STATE: DungeonSuggestionsState = {
  status: 'idle',
  ranking: [],
  characterCount: 0,
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
 * group-level ranking of dungeons by lowest combined score.
 *
 * Refetches whenever `dungeonSuggestionsRefreshKey` in the store bumps —
 * the wheel-spin trigger drives that refresh so scores stay current
 * between rounds.
 *
 * Players without a parseable `inGameName` (e.g. "Tytanium-Stormrage")
 * are skipped — the result reflects whoever has linkable characters.
 */
export function useDungeonSuggestions(players: readonly WoWPlayer[]): DungeonSuggestionsState {
  const refreshKey = useAppStore((s) => s.dungeonSuggestionsRefreshKey);
  const [state, setState] = useState<DungeonSuggestionsState>(IDLE_STATE);
  // Identify the player set by their lookup keys so we re-run when roster changes.
  const targets = buildLookupTargets(players);
  const playersKey = targets.map(t => t.key).sort().join('|');

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();

    if (targets.length === 0) {
      setState({ ...IDLE_STATE, status: 'empty' });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setState((s) => ({ ...s, status: 'loading', lookupTargetCount: targets.length }));

    let cancelled = false;
    Promise.all(
      targets.map(t =>
        fetchCharacterDungeonScores(t.name, t.realm, t.region, controller.signal),
      ),
    )
      .then((results) => {
        if (cancelled || controller.signal.aborted) return;
        const valid = results.filter((r): r is CharacterDungeonScores => r !== null);
        const ranking = computeDungeonRanking(valid);
        // Surface 'error' when every fetch failed (the underlying service
        // swallows individual failures and returns null) so the UI can be
        // honest about why we have no data, instead of showing "no runs".
        const status: DungeonSuggestionsState['status'] =
          ranking.length > 0
            ? 'ready'
            : valid.length === 0 && targets.length > 0
              ? 'error'
              : 'empty';
        setState({
          status,
          ranking,
          characterCount: valid.length,
          lookupTargetCount: targets.length,
        });
      })
      .catch((err) => {
        if (cancelled || controller.signal.aborted) return;
        console.warn('[Wheelson] Dungeon suggestions fetch failed:', err);
        setState({
          status: 'error',
          ranking: [],
          characterCount: 0,
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

  return state;
}
