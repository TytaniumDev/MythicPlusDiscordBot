import { useState } from 'react';
import type { CharacterClass } from '@mythicplus/shared';
import { remapImageUrl } from '../discordSdk';
import { toMainBodyUrl } from '../lib/characterMedia';
import { getClassColor } from '../lib/classColors';

interface SpotlightPortraitProps {
  name: string;
  characterClass: CharacterClass | null | undefined;
  mediaUrl: string | null | undefined;
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

export function SpotlightPortrait({ name, characterClass, mediaUrl }: SpotlightPortraitProps) {
  const fullBodyUrl = toMainBodyUrl(mediaUrl);
  const proxiedUrl = remapImageUrl(fullBodyUrl);
  const color = getClassColor(characterClass) ?? DEFAULT_COLOR;
  const [failed, setFailed] = useState(false);
  const showImage = proxiedUrl && !failed;

  return (
    <div
      className="spotlight-portrait"
      style={{ '--ch-color': color } as React.CSSProperties}
      title={name}
    >
      <div className="spotlight-portrait__stage">
        {showImage ? (
          <img
            src={proxiedUrl}
            alt={`${name} character portrait`}
            title={name}
            className="spotlight-portrait__img"
            onError={() => setFailed(true)}
          />
        ) : (
          <FallbackAvatar color={color} />
        )}
        <div className="spotlight-portrait__name">{name}</div>
      </div>
    </div>
  );
}
