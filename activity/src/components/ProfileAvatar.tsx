import type { CSSProperties } from 'react';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';
import { useAppStore } from '../store/store';

interface ProfileAvatarProps {
  onClick: () => void;
}

export function ProfileAvatar({ onClick }: ProfileAvatarProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const channelData = useAppStore((s) => s.channelData);

  const player = currentPlayerId && channelData
    ? channelData.players.find((p) => p.discordId === currentPlayerId)
    : null;

  const avatarUrl = toAvatarUrl(player?.mediaUrl ?? null);
  const proxied = remapImageUrl(avatarUrl ?? undefined);
  const ringColor = getClassColor(player?.characterClass) ?? '#888';
  const initial = (currentPlayerName ?? '?').charAt(0).toUpperCase();

  const disabled = !currentPlayerId;

  return (
    <button
      type="button"
      className="profile-avatar"
      onClick={onClick}
      disabled={disabled}
      aria-label={disabled ? 'Profile (sign in to view)' : `Profile of ${currentPlayerName}`}
      style={{ '--avatar-ring': ringColor } as CSSProperties}
    >
      {proxied ? (
        <img src={proxied} alt="" className="profile-avatar__img" />
      ) : (
        <span className="profile-avatar__initial">{initial}</span>
      )}
    </button>
  );
}
