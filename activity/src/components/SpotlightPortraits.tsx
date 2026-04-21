import { WoWPlayer } from '../types';
import { SpotlightPortrait } from './SpotlightPortrait';

interface SpotlightPortraitsProps {
  players: WoWPlayer[];
}

export function SpotlightPortraits({ players }: SpotlightPortraitsProps) {
  if (players.length === 0) return null;

  return (
    <div className="spotlight-portraits" data-testid="spotlight-portraits">
      {players.map((player, index) => (
        <SpotlightPortrait
          key={player.discordId || player.name || index}
          name={player.name}
          characterClass={player.characterClass}
          mediaUrl={player.mediaUrl}
        />
      ))}
    </div>
  );
}
