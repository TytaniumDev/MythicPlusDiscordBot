import type { CSSProperties } from 'react';
import { getClassColor } from '../lib/classColors';
import { useMyProfile } from '../hooks/useMyProfile';
import { CharacterImage } from './CharacterImage';

interface ProfileAvatarProps {
  onClick: () => void;
}

export function ProfileAvatar({ onClick }: ProfileAvatarProps) {
  const { player, displayName } = useMyProfile();

  const ringColor = getClassColor(player?.characterClass ?? null) ?? '#888';
  const initial = (displayName ?? '?').charAt(0).toUpperCase();

  // Always actionable — even with no character set, the slot opens
  // ProfileModal so users can set up.
  const ariaLabel = displayName
    ? `Profile of ${displayName}`
    : 'Set up your character';

  return (
    <button
      type="button"
      className={`profile-avatar${!displayName ? ' profile-avatar--placeholder' : ''}`}
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ '--avatar-ring': ringColor } as CSSProperties}
    >
      <CharacterImage
        mediaUrl={player?.mediaUrl ?? null}
        variant="avatar"
        className="profile-avatar__img"
        fallback={<span className="profile-avatar__initial">{initial}</span>}
      />
    </button>
  );
}
