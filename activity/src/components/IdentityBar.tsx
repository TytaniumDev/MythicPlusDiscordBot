import { useAppStore } from '../store/store';
import { useIdentity } from '../hooks/useIdentity';
import type { WoWPlayer } from '../types';

interface IdentityBarProps {
  players: WoWPlayer[];
}

/**
 * Compact identity selector shown in WheelsView and ResultsView.
 * Prompts users to select themselves so their group can be highlighted.
 * Unlike the full IdentitySelector (lobby-only), this is designed to be
 * unobtrusive but noticeable when identity hasn't been resolved.
 */
export function IdentityBar({ players }: IdentityBarProps) {
  const { selectPlayer, clearIdentity, identityResolved, currentPlayerName } = useIdentity();
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);

  if (players.length === 0) return null;

  if (identityResolved && currentPlayerId) {
    return (
      <div className="identity-bar identity-bar-resolved">
        <span className="identity-bar-label">
          Viewing as{' '}
          <button className="identity-bar-name" onClick={clearIdentity} title="Click to change">
            {currentPlayerName ?? 'Unknown'}
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="identity-bar identity-bar-unresolved">
      <span className="identity-bar-prompt">Select yourself to highlight your group:</span>
      <div className="identity-bar-chips">
        {players.map((p) => (
          <button
            key={p.discordId || p.name}
            className="identity-bar-chip"
            onClick={() => selectPlayer(p)}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
