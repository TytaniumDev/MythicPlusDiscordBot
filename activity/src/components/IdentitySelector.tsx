import { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useIdentity } from '../hooks/useIdentity';

interface IdentitySelectorProps {
  players: WoWPlayer[];
}

export function IdentitySelector({ players }: IdentitySelectorProps) {
  const { selectPlayer, clearIdentity, identityResolved, currentPlayerName } = useIdentity();
  const roleEditorVisible = useAppStore((s) => s.roleEditorVisible);

  if (!identityResolved) {
    return (
      <div id="identity-selector" className="identity-selector">
        <div className="identity-label">Select yourself to highlight your group:</div>
        <div className="identity-chips">
          {players.map((p) => (
            <button
              key={p.discordId || p.name}
              className="identity-chip"
              onClick={() => selectPlayer(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div id="identity-selector" className="identity-selector">
      <div className="identity-current">
        <button
          className="identity-name"
          title="Click to change identity"
          onClick={clearIdentity}
        >
          {currentPlayerName ?? 'Unknown'}
        </button>
      </div>
      <button
        className="btn btn-secondary btn-change-roles"
        onClick={() => {
          useAppStore.getState().setRoleEditorManuallyToggled(true);
          useAppStore.getState().setRoleEditorVisible(!roleEditorVisible);
        }}
      >
        {roleEditorVisible ? 'Hide Roles' : 'Change Roles'}
      </button>
    </div>
  );
}
