import { WoWPlayer } from '../types';
import { useIdentity } from '../hooks/useIdentity';

interface IdentitySelectorProps {
  players: WoWPlayer[];
}

export function IdentitySelector({ players }: IdentitySelectorProps) {
  const { selectPlayer, clearIdentity, identityResolved, currentPlayerName } = useIdentity();

  if (!identityResolved) {
    return (
      <div id="identity-selector" className="identity-selector" role="region" aria-label="Identity Selection">
        <div className="identity-label">Select yourself to highlight your group:</div>
        <div className="identity-chips">
          {players.map((p) => (
            <button
              key={p.discordId || p.name}
              className="identity-chip"
              onClick={() => selectPlayer(p)}
              aria-label={`Select ${p.name} as your identity`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div id="identity-selector" className="identity-selector" role="region" aria-label="Identity Selection">
      <div className="identity-current">
        <button
          className="identity-name"
          title="Click to change identity"
          aria-label={`Change identity, currently selected as ${currentPlayerName ?? 'Unknown'}`}
          onClick={clearIdentity}
        >
          {currentPlayerName ?? 'Unknown'}
        </button>
      </div>
    </div>
  );
}
