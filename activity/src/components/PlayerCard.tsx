import { useState, useEffect } from 'react';
import { WoWPlayer } from '../types';
import { CharacterHeader } from './CharacterHeader';
import { Divider } from './ui';
import { RoleEditor } from './RoleEditor';
import { getPrimaryRole } from '../lib/roles';

const ROLE_COLOR_MAP: Record<string, string> = {
  tank: 'var(--color-tank)',
  healer: 'var(--color-healer)',
  ranged: 'var(--color-dps)',
  melee: 'var(--color-dps)',
  unassigned: 'var(--text-secondary)',
};

interface PlayerCardProps {
  player: WoWPlayer;
  className?: string;
}

export function PlayerCard({ player, className = '' }: PlayerCardProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  const playerId = player.discordId ?? null;

  // Only reset mediaUrl when the player identity changes (not on every Firestore update),
  // so the image persists through the Firestore sync triggered by saveRoles.
  useEffect(() => {
    setMediaUrl(player.mediaUrl ?? null);
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const primaryRole = getPrimaryRole(player);
  const color = ROLE_COLOR_MAP[primaryRole] ?? ROLE_COLOR_MAP.unassigned;

  // Compute class name from in-game name or character lookup
  const classSubtitle = player.inGameName || undefined;

  return (
    <div className={`player-card ${className}`} data-testid="player-card">
      <CharacterHeader
        name={player.name}
        subtitle={classSubtitle}
        color={color}
        imageUrl={mediaUrl}
      />

      <Divider />

      <div className="player-card__form">
        <RoleEditor
          player={player}
          onMediaUrlChange={setMediaUrl}
        />
      </div>
    </div>
  );
}
