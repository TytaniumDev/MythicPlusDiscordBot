import type { CSSProperties } from 'react';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';
import { useAppStore } from '../store/store';

interface ProfileAvatarProps {
  onClick: () => void;
}

export function ProfileAvatar({ onClick }: ProfileAvatarProps) {
  const currentCharacter = useAppStore((s) => s.currentCharacter);
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const channelData = useAppStore((s) => s.channelData);

  // Prefer the per-browser local character (works on every view, even
  // outside a voice channel). Fall back to channelData lookup for
  // returning users who haven't yet hydrated their local character.
  const channelPlayer = currentPlayerId && channelData
    ? channelData.players.find((p) => p.discordId === currentPlayerId)
    : null;

  const mediaUrl = currentCharacter?.mediaUrl ?? channelPlayer?.mediaUrl ?? null;
  const characterClass = currentCharacter?.characterClass ?? channelPlayer?.characterClass ?? null;
  const displayName = (currentCharacter?.inGameName?.split('-')[0]) || currentPlayerName || channelPlayer?.name || null;

  const proxied = remapImageUrl(toAvatarUrl(mediaUrl) ?? undefined);
  const ringColor = getClassColor(characterClass) ?? '#888';
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
      {proxied ? (
        <img src={proxied} alt="" className="profile-avatar__img" />
      ) : (
        <span className="profile-avatar__initial">{initial}</span>
      )}
    </button>
  );
}
