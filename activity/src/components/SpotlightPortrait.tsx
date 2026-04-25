import { useId, useState } from 'react';
import type { CharacterClass } from '@mythicplus/shared';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';
import { remapImageUrl } from '../discordSdk';
import { toMainBodyUrl } from '../lib/characterMedia';
import { getClassColor } from '../lib/classColors';

interface SpotlightPortraitProps {
  name: string;
  characterClass: CharacterClass | null | undefined;
  mediaUrl: string | null | undefined;
  /** When provided, hovering/focusing the portrait shows a Raider.io score tooltip. */
  scores?: CharacterDungeonScores | null;
}

const DEFAULT_COLOR = '#808080';

function FallbackAvatar({ color }: { color: string }) {
  return (
    <div
      className="spotlight-portrait__fallback"
      style={{ color: `${color}80` }}
      aria-hidden="true"
    >
      ?
    </div>
  );
}

export function SpotlightPortrait({ name, characterClass, mediaUrl, scores }: SpotlightPortraitProps) {
  const fullBodyUrl = toMainBodyUrl(mediaUrl);
  const proxiedUrl = remapImageUrl(fullBodyUrl);
  const color = getClassColor(characterClass) ?? DEFAULT_COLOR;
  const [failed, setFailed] = useState(false);
  const showImage = proxiedUrl && !failed;
  const tooltipId = useId();
  const hasTooltip = Boolean(scores);

  return (
    <div
      className={`spotlight-portrait${hasTooltip ? ' spotlight-portrait--has-tooltip' : ''}`}
      style={{ '--ch-color': color } as React.CSSProperties}
      title={hasTooltip ? undefined : name}
      tabIndex={hasTooltip ? 0 : undefined}
      aria-describedby={hasTooltip ? tooltipId : undefined}
    >
      <div className="spotlight-portrait__stage">
        {showImage ? (
          <img
            src={proxiedUrl}
            alt={`${name} character portrait`}
            className="spotlight-portrait__img"
            onError={() => setFailed(true)}
          />
        ) : (
          <FallbackAvatar color={color} />
        )}
        <div className="spotlight-portrait__name">{name}</div>
      </div>
      {hasTooltip && scores && (
        <ScoreTooltip id={tooltipId} name={name} scores={scores} />
      )}
    </div>
  );
}

interface ScoreTooltipProps {
  id: string;
  name: string;
  scores: CharacterDungeonScores;
}

function ScoreTooltip({ id, name, scores }: ScoreTooltipProps) {
  // Per-dungeon entries sorted by best score, descending — highest first
  // matches what the player would expect to see on their Raider.io page.
  const dungeons = Object.values(scores.byDungeon)
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score);

  return (
    <div role="tooltip" id={id} className="spotlight-portrait__tooltip">
      <div className="spotlight-portrait__tooltip-header">
        <span className="spotlight-portrait__tooltip-name">{name}</span>
        <span className="spotlight-portrait__tooltip-overall">
          {scores.overallScore !== null ? (
            <>
              <strong style={{ color: scores.scoreColor ?? 'inherit' }}>
                {Math.round(scores.overallScore)}
              </strong>
              <span className="spotlight-portrait__tooltip-overall-label"> RIO</span>
            </>
          ) : (
            <span className="spotlight-portrait__tooltip-overall-label">No score yet</span>
          )}
        </span>
      </div>
      {dungeons.length > 0 ? (
        <ul className="spotlight-portrait__tooltip-list">
          {dungeons.map((d) => (
            <li key={d.challengeModeId} className="spotlight-portrait__tooltip-row">
              <span className="spotlight-portrait__tooltip-dungeon" title={d.name}>
                {d.name || d.shortName}
              </span>
              <span className="spotlight-portrait__tooltip-key">+{d.level}</span>
              <span className="spotlight-portrait__tooltip-score">
                {Math.round(d.score)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="spotlight-portrait__tooltip-empty">No timed runs yet this season.</p>
      )}
    </div>
  );
}
