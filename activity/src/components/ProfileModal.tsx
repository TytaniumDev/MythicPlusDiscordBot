import { useMemo } from 'react';
import { useAppStore } from '../store/store';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';
import { RoleEditor } from './RoleEditor';
import { Divider } from './ui';
import type { WoWPlayer } from '../types';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onOpenConnections: () => void;
}

/**
 * Build a "shim" WoWPlayer from currentCharacter so RoleEditor can run in
 * profile-edit mode. Used when there's no channelData entry for the user
 * (outside a voice channel, or before identity resolves).
 */
function buildShimPlayer(
  currentCharacter: ReturnType<typeof useAppStore.getState>['currentCharacter'],
  discordId: string | null,
  displayName: string,
): WoWPlayer {
  return {
    name: displayName,
    discordId: discordId ?? '',
    inGameName: currentCharacter?.inGameName ?? '',
    mainRole: null,
    offspecs: [],
    utilities: [],
    mediaUrl: currentCharacter?.mediaUrl ?? null,
    characterClass: currentCharacter?.characterClass ?? null,
  };
}

export function ProfileModal({ open, onClose, onOpenConnections }: ProfileModalProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const currentCharacter = useAppStore((s) => s.currentCharacter);
  const channelData = useAppStore((s) => s.channelData);

  // Prefer the real channelData player when available — that's the canonical
  // record for in-voice users (includes role state). Fall back to a shim
  // built from currentCharacter for outside-channel use.
  const channelPlayer = currentPlayerId && channelData
    ? channelData.players.find((p) => p.discordId === currentPlayerId)
    : null;

  const editPlayer = useMemo<WoWPlayer>(
    () => channelPlayer ?? buildShimPlayer(
      currentCharacter,
      currentPlayerId,
      currentPlayerName ?? currentCharacter?.inGameName?.split('-')[0] ?? 'You',
    ),
    [channelPlayer, currentCharacter, currentPlayerId, currentPlayerName],
  );

  if (!open) return null;

  // The avatar mirrors ProfileAvatar's lookup priority — slice first, channel second.
  const mediaUrl = currentCharacter?.mediaUrl ?? channelPlayer?.mediaUrl ?? null;
  const characterClass = currentCharacter?.characterClass ?? channelPlayer?.characterClass ?? null;
  const displayName = currentCharacter?.inGameName?.split('-')[0]
    ?? currentPlayerName
    ?? channelPlayer?.name
    ?? 'You';

  const proxied = remapImageUrl(toAvatarUrl(mediaUrl) ?? undefined);
  const ring = getClassColor(characterClass) ?? '#888';

  // Profile-edit mode: writes go through currentCharacter slice + localStorage
  // (always), and mirror to preferences only when discordId is non-empty.
  // channelData updates indirectly via the bot reading preferences when
  // refreshPlayers triggers.
  const isProfileEdit = !channelPlayer;

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
            : <span>{displayName.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="profile-modal__name">{displayName}</div>
        {currentPlayerId && (
          <div className="profile-modal__field">
            <span className="profile-modal__label">Discord ID</span>
            <span className="profile-modal__value">{currentPlayerId}</span>
          </div>
        )}

        <Divider />

        <div className="profile-modal__editor">
          <RoleEditor
            player={editPlayer}
            isProfileEdit={isProfileEdit}
            hideSitOut
          />
        </div>

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
