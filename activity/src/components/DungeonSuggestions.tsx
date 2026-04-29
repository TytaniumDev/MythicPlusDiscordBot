import { useId } from 'react';
import type { DungeonSuggestion, DungeonSuggestionsStatus } from '../lib/dungeonSuggestions';
import { remapImageUrl } from '../discordSdk';
import { KeyLevelSelect } from './KeyLevelSelect';

interface DungeonSuggestionsProps {
  status: DungeonSuggestionsStatus;
  ranking: DungeonSuggestion[];
  lookupTargetCount: number;
  /** How many dungeons to render (default 5). */
  limit?: number;
  /**
   * `'horizontal'` lays the keys out in a row (used on the Results page so the
   * panel sits between the spotlight portraits and the group cards).
   * `'vertical'` stacks them in a sidebar-style list — used by Storybook
   * variants and stays available for future placements.
   */
  layout?: 'vertical' | 'horizontal';
  /** Currently selected key level (drives the projected-gain ranking). */
  keyLevel: number;
  /** Called when the user picks a different level from the select. */
  onKeyLevelChange: (level: number) => void;
}

const DEFAULT_LIMIT = 5;

/**
 * User-facing explanation of how the ranking is computed. Surfaced via the
 * info tooltip in the panel. **Update this whenever the strategy changes** so
 * the tooltip and the implementation never drift.
 */
const STRATEGY_EXPLANATION =
  "Pick a key level you're considering running. For each dungeon, we " +
  "count how many key levels every group member would gain by timing it " +
  "at that level (counted as 0 if they've already timed a higher key). " +
  "Dungeons rank by total levels of upside — the top one is where the " +
  "most members stand to push their best. Ties break to whichever " +
  "dungeon more players stand to gain on.";

/**
 * Renders a ranked list of dungeons sorted by greatest key-level upside at
 * the chosen projection level — i.e. the dungeons where this group has
 * the most levels left to gain across its members.
 *
 * Pure presentational component: data fetching lives in `useDungeonSuggestions`.
 * That keeps it easy to swap in mocked rankings for stories and tests.
 */
export function DungeonSuggestions({
  status,
  ranking,
  lookupTargetCount,
  limit = DEFAULT_LIMIT,
  layout = 'vertical',
  keyLevel,
  onKeyLevelChange,
}: DungeonSuggestionsProps) {
  const selectId = useId();
  return (
    <aside
      className={`dungeon-suggestions dungeon-suggestions--${layout}`}
      aria-label="Dungeon suggestions"
    >
      <div className="dungeon-suggestions__header">
        <div className="dungeon-suggestions__title-row">
          <h3 className="dungeon-suggestions__heading">Suggested Keys</h3>
          <InfoTooltip />
        </div>
        <p className="dungeon-suggestions__subtitle">
          <span>Most key-level upside at</span>
          <KeyLevelSelect
            id={selectId}
            ariaLabel="Key level for projection"
            value={keyLevel}
            onChange={onKeyLevelChange}
            compact
          />
        </p>
      </div>

      {status === 'idle' && <EmptyState message="No characters linked yet." />}
      {status === 'loading' && <LoadingState layout={layout} />}
      {status === 'error' && <EmptyState message="Couldn't reach Raider.io." />}
      {status === 'empty' && (
        <EmptyState message={
          lookupTargetCount === 0
            ? 'Link characters (Name-Realm) to see suggestions.'
            : 'No Mythic+ runs on file for this group yet.'
        } />
      )}

      {status === 'ready' && (
        <ol className="dungeon-suggestions__list">
          {ranking.slice(0, limit).map((d, i) => (
            <DungeonRow key={d.challengeModeId} suggestion={d} rank={i + 1} />
          ))}
        </ol>
      )}
    </aside>
  );
}

interface DungeonRowProps {
  suggestion: DungeonSuggestion;
  rank: number;
}

function DungeonRow({ suggestion, rank }: DungeonRowProps) {
  const proxiedIconUrl = remapImageUrl(suggestion.iconUrl);
  return (
    <li className="dungeon-suggestion-row">
      <span className="dungeon-suggestion-row__rank">{rank}</span>
      {proxiedIconUrl ? (
        <img
          className="dungeon-suggestion-row__icon"
          src={proxiedIconUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
        />
      ) : (
        <span className="dungeon-suggestion-row__icon dungeon-suggestion-row__icon--placeholder" aria-hidden="true" />
      )}
      <div className="dungeon-suggestion-row__body">
        <span className="dungeon-suggestion-row__name">{suggestion.name || suggestion.shortName}</span>
        <span className="dungeon-suggestion-row__meta">
          +{suggestion.projectedGain} {suggestion.projectedGain === 1 ? 'level' : 'levels'} of upside
          {suggestion.avgLevel !== null && (
            <> · avg +{suggestion.avgLevel}</>
          )}
        </span>
      </div>
    </li>
  );
}

function LoadingState({ layout }: { layout: 'vertical' | 'horizontal' }) {
  return (
    <ul
      className={`dungeon-suggestions__list dungeon-suggestions__list--skeleton dungeon-suggestions__list--${layout}-skeleton`}
      aria-hidden="true"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="dungeon-suggestion-row dungeon-suggestion-row--skeleton">
          <span className="dungeon-suggestion-row__rank" />
          <span className="dungeon-suggestion-row__icon" />
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

function InfoTooltip() {
  // useId so the tooltip can be aria-describedby-linked to the trigger button
  // without stomping in stories that mount multiple panels.
  const tooltipId = useId();
  return (
    <span className="info-tooltip">
      <button
        type="button"
        className="info-tooltip__trigger"
        aria-label="How is this ranked?"
        aria-describedby={tooltipId}
      >
        {/* lowercase "i" inside a circle */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="4.75" r="0.9" fill="currentColor" />
          <path d="M8 7.5v4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <span role="tooltip" id={tooltipId} className="info-tooltip__bubble">
        {STRATEGY_EXPLANATION}
      </span>
    </span>
  );
}
