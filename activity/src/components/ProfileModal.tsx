import { useAppStore } from '../store/store';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onOpenConnections: () => void;
}

export function ProfileModal({ open, onClose, onOpenConnections }: ProfileModalProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const channelData = useAppStore((s) => s.channelData);

  if (!open) return null;

  const player = currentPlayerId && channelData
    ? channelData.players.find((p) => p.discordId === currentPlayerId)
    : null;

  const avatarUrl = toAvatarUrl(player?.mediaUrl ?? null);
  const proxied = remapImageUrl(avatarUrl ?? undefined);
  const ring = getClassColor(player?.characterClass) ?? '#888';

  return (
    <div className="profile-modal__backdrop" onClick={onClose}>
      <div
        className="profile-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Profile"
      >
        <div className="profile-modal__avatar" style={{ borderColor: ring }}>
          {proxied
            ? <img src={proxied} alt="" />
            : <span>{(currentPlayerName ?? '?').charAt(0).toUpperCase()}</span>}
        </div>
        <div className="profile-modal__name">{currentPlayerName ?? '—'}</div>
        <div className="profile-modal__field">
          <span className="profile-modal__label">Discord ID</span>
          <span className="profile-modal__value">{currentPlayerId ?? '—'}</span>
        </div>
        {player?.inGameName && (
          <div className="profile-modal__field">
            <span className="profile-modal__label">In-game name</span>
            <span className="profile-modal__value">{player.inGameName}</span>
          </div>
        )}
        {player?.characterClass && (
          <div className="profile-modal__field">
            <span className="profile-modal__label">Class</span>
            <span className="profile-modal__value">{player.characterClass}</span>
          </div>
        )}
        <button
          type="button"
          className="profile-modal__connections-link"
          onClick={onOpenConnections}
        >
          View Connections →
        </button>
        <button type="button" className="profile-modal__close" onClick={onClose} aria-label="Close">×</button>
      </div>
    </div>
  );
}
