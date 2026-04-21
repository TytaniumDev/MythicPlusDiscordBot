import { useState, useEffect } from 'react';
import { WoWPlayer } from '../types';
import { CharacterHeader } from './CharacterHeader';
import { Divider } from './ui';
import { RoleEditor } from './RoleEditor';
import { getPrimaryRole, getRoleColor } from '../lib/roles';

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

  const color = getRoleColor(getPrimaryRole(player));

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
