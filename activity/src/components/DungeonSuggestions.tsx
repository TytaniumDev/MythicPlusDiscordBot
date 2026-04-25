import type { DungeonSuggestion, DungeonSuggestionsStatus } from '../lib/dungeonSuggestions';

interface DungeonSuggestionsProps {
  status: DungeonSuggestionsStatus;
  ranking: DungeonSuggestion[];
  characterCount: number;
  lookupTargetCount: number;
  /** How many dungeons to render (default 5). */
  limit?: number;
}

const DEFAULT_LIMIT = 5;

/**
 * Renders a ranked list of dungeons sorted by lowest combined Raider.io score
 * across the active group — i.e. dungeons where the group has the most upside.
 *
 * Pure presentational component: data fetching lives in `useDungeonSuggestions`.
 * That keeps it easy to swap in mocked rankings for stories and tests.
 */
export function DungeonSuggestions({
  status,
  ranking,
  characterCount,
  lookupTargetCount,
  limit = DEFAULT_LIMIT,
}: DungeonSuggestionsProps) {
  return (
    <aside className="dungeon-suggestions" aria-label="Dungeon suggestions">
      <h3 className="dungeon-suggestions__heading">Suggested Keys</h3>
      <p className="dungeon-suggestions__subtitle">
        Lowest combined Raider.io score
      </p>

      {status === 'idle' && <EmptyState message="No characters linked yet." />}
      {status === 'loading' && <LoadingState />}
      {status === 'error' && <EmptyState message="Couldn't reach Raider.io." />}
      {status === 'empty' && (
        <EmptyState message={
          lookupTargetCount === 0
            ? 'Link characters (Name-Realm) to see suggestions.'
            : 'No Mythic+ runs on file for this group yet.'
        } />
      )}

      {status === 'ready' && (
        <>
          <ol className="dungeon-suggestions__list">
            {ranking.slice(0, limit).map((d, i) => (
              <DungeonRow key={d.challengeModeId} suggestion={d} rank={i + 1} />
            ))}
          </ol>
          <p className="dungeon-suggestions__footnote">
            Based on {characterCount} {characterCount === 1 ? 'character' : 'characters'}
          </p>
        </>
      )}
    </aside>
  );
}

interface DungeonRowProps {
  suggestion: DungeonSuggestion;
  rank: number;
}

function DungeonRow({ suggestion, rank }: DungeonRowProps) {
  return (
    <li className="dungeon-suggestion-row">
      <span className="dungeon-suggestion-row__rank">{rank}</span>
      <div className="dungeon-suggestion-row__body">
        <span className="dungeon-suggestion-row__name" title={suggestion.name}>
          {suggestion.shortName || suggestion.name}
        </span>
        <span className="dungeon-suggestion-row__meta">
          {suggestion.totalScore.toFixed(0)} pts
          {suggestion.avgLevel !== null && (
            <> · avg +{suggestion.avgLevel}</>
          )}
        </span>
      </div>
    </li>
  );
}

function LoadingState() {
  return (
    <ul className="dungeon-suggestions__list dungeon-suggestions__list--skeleton" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="dungeon-suggestion-row dungeon-suggestion-row--skeleton">
          <span className="dungeon-suggestion-row__rank" />
          <div className="dungeon-suggestion-row__body">
            <span className="dungeon-suggestion-row__name" />
            <span className="dungeon-suggestion-row__meta" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="dungeon-suggestions__empty">{message}</p>;
}
