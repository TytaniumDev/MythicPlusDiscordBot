import type { ReactNode } from 'react';
import { CharacterImage } from './CharacterImage';

interface CharacterStageProps {
  mediaUrl: string | null | undefined;
  /** Class colour for the glow and pedestal. Neutral grey when absent. */
  color?: string | null;
  /** Greyed out, e.g. while the player sits out. */
  dimmed?: boolean;
  alt: string;
  /** Shown over the placeholder outline when there is no render. */
  caption?: ReactNode;
  className?: string;
}

const NEUTRAL_COLOR = '#6b7280';

/**
 * A full-body character render standing on a class-coloured pedestal. The
 * stage can be any size: the render is cropped against the stage's height
 * (see `.character-stage__img`), so it fills a narrow column or a wide banner
 * alike. Size and shape it from the parent.
 */
export function CharacterStage({ mediaUrl, color, dimmed = false, alt, caption, className }: CharacterStageProps) {
  const neutral = dimmed || !color;
  const classes = ['character-stage'];
  if (neutral) classes.push('character-stage--neutral');
  if (dimmed) classes.push('character-stage--dimmed');
  if (className) classes.push(className);

  return (
    <div className={classes.join(' ')} style={{ '--stage-color': neutral ? NEUTRAL_COLOR : color } as React.CSSProperties}>
      <span className="character-stage__pedestal" aria-hidden="true" />
      <CharacterImage
        mediaUrl={mediaUrl}
        variant="body"
        alt={alt}
        className="character-stage__img"
        fallback={<StagePlaceholder caption={caption} />}
      />
    </div>
  );
}

function StagePlaceholder({ caption }: { caption?: ReactNode }) {
  return (
    <>
      <svg className="character-stage__placeholder" viewBox="0 0 60 140" aria-hidden="true">
        <circle cx="30" cy="15" r="11" />
        <path d="M14 34 Q30 27 46 34 L51 78 L45 80 L42 58 L41 134 L33 134 L31 92 L29 92 L27 134 L19 134 L18 58 L15 80 L9 78 Z" />
      </svg>
      {caption && <p className="character-stage__caption">{caption}</p>}
    </>
  );
}
