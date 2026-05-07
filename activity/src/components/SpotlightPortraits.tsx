import { WoWPlayer } from '../types';
import type { CharacterDungeonScores } from '../lib/dungeonScoreTypes';
import { SpotlightPortrait } from './SpotlightPortrait';

interface SpotlightPortraitsProps {
  players: WoWPlayer[];
  /**
   * Optional per-player Raider.io M+ score data. When supplied, each portrait
   * shows a hover/focus tooltip with overall + per-dungeon scores. Used by
   * the Results view; the wheel-reveal SpotlightCard leaves it undefined.
   */
  scoresByDiscordId?: ReadonlyMap<string, CharacterDungeonScores | null>;
}

export function SpotlightPortraits({ players, scoresByDiscordId }: SpotlightPortraitsProps) {
  if (players.length === 0) return null;

  return (
    <div className="spotlight-portraits" data-testid="spotlight-portraits">
      {players.map((player, index) => {
        const scores = player.discordId
          ? scoresByDiscordId?.get(player.discordId) ?? null
          : null;
        return (
          <SpotlightPortrait
            key={player.discordId || player.name || index}
            name={player.name}
            characterClass={player.characterClass}
            mediaUrl={player.mediaUrl}
            scores={scores}
          />
        );
      })}
    </div>
  );
}
