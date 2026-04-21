import { useState } from 'react';
import { WoWPlayer } from '../types';
import { remapImageUrl } from '../discordSdk';
import { getPrimaryRole } from '../lib/roles';

interface SpotlightPortraitsProps {
  players: WoWPlayer[];
}

const ROLE_COLOR_MAP: Record<string, string> = {
  tank: 'var(--color-tank)',
  healer: 'var(--color-healer)',
  ranged: 'var(--color-dps)',
  melee: 'var(--color-dps)',
  unassigned: 'var(--text-secondary)',
};

function FallbackAvatar({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={`${color}54`}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="spotlight-portrait__svg"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function Portrait({ player }: { player: WoWPlayer }) {
  const proxiedUrl = remapImageUrl(player.mediaUrl);
  const color = ROLE_COLOR_MAP[getPrimaryRole(player)] ?? ROLE_COLOR_MAP.unassigned;
  const [failed, setFailed] = useState(false);
  const showImage = proxiedUrl && !failed;

  return (
    <div
      className="spotlight-portrait"
      style={{ '--ch-color': color } as React.CSSProperties}
      title={player.name}
    >
      {showImage ? (
        <img
          src={proxiedUrl}
          alt={`${player.name} character portrait`}
          className="spotlight-portrait__img"
          onError={() => setFailed(true)}
        />
      ) : (
        <FallbackAvatar color={color} />
      )}
    </div>
  );
}

export function SpotlightPortraits({ players }: SpotlightPortraitsProps) {
  if (players.length === 0) return null;

  return (
    <div className="spotlight-portraits" data-testid="spotlight-portraits">
      {players.map((player, index) => (
        <Portrait key={player.discordId || player.name || index} player={player} />
      ))}
    </div>
  );
}
