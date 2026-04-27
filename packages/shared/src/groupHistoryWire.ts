import type { WoWGroupDict } from './types.js';

/**
 * Firestore wire-format codec for the `groupHistory.rounds` field.
 *
 * Why a wrapper exists: Firestore rejects directly-nested arrays
 * (`Array<Array<...>>`). Each round, which is itself an array of group dicts,
 * is therefore wrapped as `{ groups: [...] }` so the outer field is an array
 * of objects rather than an array of arrays.
 *
 * The decoder also tolerates the legacy flat shape (`Array<Array<...>>`) for
 * documents written before the wrapping was introduced. Garbage entries
 * (null, missing `groups`, non-array `groups`) are skipped silently — a
 * malformed history record must never block a spin.
 */

/** Wrapped wire shape for a single round, as written to Firestore. */
export interface WireRound {
  groups: WoWGroupDict[];
}

/**
 * Wrap each round as `{ groups: [...] }` for Firestore persistence.
 */
export function encodeGroupHistoryRounds(rounds: WoWGroupDict[][]): WireRound[] {
  return rounds.map((round) => ({ groups: round }));
}

/**
 * Decode the persisted `rounds` array into the in-memory shape.
 *
 * Accepts both the current wrapped shape (`{ groups: WoWGroupDict[] }`) and
 * the legacy flat shape (`WoWGroupDict[]`). Entries that match neither shape
 * are dropped — callers should treat a missing/garbage round as "no history"
 * rather than failing the operation.
 */
export function decodeGroupHistoryRounds(raw: unknown[]): WoWGroupDict[][] {
  const out: WoWGroupDict[][] = [];
  for (const r of raw) {
    if (Array.isArray(r)) {
      // Legacy flat shape: round is itself an array of group dicts.
      out.push(r as WoWGroupDict[]);
      continue;
    }
    if (
      r !== null
      && typeof r === 'object'
      && 'groups' in r
      && Array.isArray((r as { groups: unknown }).groups)
    ) {
      out.push((r as { groups: WoWGroupDict[] }).groups);
      continue;
    }
    // Skip anything else (null, missing groups, non-array groups).
  }
  return out;
}
