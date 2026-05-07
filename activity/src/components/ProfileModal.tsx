import { useMemo } from 'react';
import { useAppStore } from '../store/store';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';
import { RoleEditor } from './RoleEditor';
import { Divider } from './ui';
import type { WoWPlayer } from '../types';
import type { CharacterClass } from '@mythicplus/shared';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onOpenConnections: () => void;
}

/**
 * Build a "shim" WoWPlayer from currentCharacter fields so RoleEditor can run
 * in profile-edit mode. Used when there's no channelData entry for the user
 * (outside a voice channel, or before identity resolves).
 *
 * Takes only the specific fields it reads (not the full StoredCharacter) so
 * callers can memoize on stable inputs without dragging in lastUpdated, which
 * changes on every persist and would cause RoleEditor to reset state.
 */
function buildShimPlayer(
  fields: { inGameName: string; mediaUrl: string | null; characterClass: CharacterClass | null },
  discordId: string | null,
  displayName: string,
): WoWPlayer {
  return {
    name: displayName,
    discordId: discordId ?? '',
    inGameName: fields.inGameName,
    mainRole: null,
    offspecs: [],
    utilities: [],
    mediaUrl: fields.mediaUrl,
    characterClass: fields.characterClass,
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

  // Stable identity for the shim — only rebuild when fields actually change.
  // Including the whole currentCharacter would also include its lastUpdated
  // timestamp, which changes on every persist and would cause RoleEditor to
  // reset its selected roles on every keystroke.
  const inGameName = currentCharacter?.inGameName;
  const mediaUrl = currentCharacter?.mediaUrl ?? null;
  const characterClass = currentCharacter?.characterClass ?? null;

  const editPlayer = useMemo<WoWPlayer>(
    () => {
      if (channelPlayer) return channelPlayer;
      const displayName = currentPlayerName ?? inGameName?.split('-')[0] ?? 'You';
      return buildShimPlayer(
        { inGameName: inGameName ?? '', mediaUrl, characterClass },
        currentPlayerId,
        displayName,
      );
    },
    [channelPlayer, inGameName, mediaUrl, characterClass, currentPlayerId, currentPlayerName],
  );

  if (!open) return null;

  // The avatar mirrors ProfileAvatar's lookup priority — slice first, channel second.
  const avatarMediaUrl = mediaUrl ?? channelPlayer?.mediaUrl ?? null;
  const avatarCharacterClass = characterClass ?? channelPlayer?.characterClass ?? null;
  const displayName = inGameName?.split('-')[0]
    ?? currentPlayerName
    ?? channelPlayer?.name
    ?? 'You';

  const proxied = remapImageUrl(toAvatarUrl(avatarMediaUrl) ?? undefined);
  const ring = getClassColor(avatarCharacterClass) ?? '#888';

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
