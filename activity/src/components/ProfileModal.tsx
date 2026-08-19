import { useMemo, useCallback } from 'react';
import { useAppStore } from '../store/store';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';
import { RoleEditor } from './RoleEditor';
import { Divider } from './ui';
import { useCharacterLookup } from '../hooks/useCharacterLookup';
import { useSessionService } from '../hooks/useSession';
import { parseInGameName, DEFAULT_REGION } from '@mythicplus/shared';
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

  const { lookup, loading: refreshLoading } = useCharacterLookup();
  const service = useSessionService();

  const handleRefresh = useCallback(async () => {
    const name = inGameName ?? '';
    const parsed = parseInGameName(name);
    if (!parsed) return;

    const character = await lookup(parsed.name, parsed.realmSlug, DEFAULT_REGION, { forceRefresh: true, silent: true });
    if (!character) return;

    // Update local slice
    const store = useAppStore.getState();
    const prev = store.currentCharacter;
    if (prev) {
      store.setCurrentCharacter({
        ...prev,
        mediaUrl: character.mediaUrl,
        characterClass: character.class,
        lookupStatus: 'ok',
        lastUpdated: Date.now(),
      });
    }

    // Persist to Firestore
    if (currentPlayerId && parsed) {
      await service.saveLinkedCharacter(
        currentPlayerId,
        { name: parsed.name, realm: parsed.realmSlug, region: DEFAULT_REGION },
        character.mediaUrl,
        character.class,
      );
    }
  }, [inGameName, currentPlayerId, lookup, service]);

  // Show refresh only when there's a valid character name (has realm component)
  const canRefresh = !!inGameName && !!parseInGameName(inGameName);

  if (!open) return null;

  // The avatar mirrors ProfileAvatar's lookup priority — slice first, channel second.
  const avatarMediaUrl = mediaUrl ?? channelPlayer?.mediaUrl ?? null;
  const avatarCharacterClass = characterClass ?? channelPlayer?.characterClass ?? null;
  const displayName = (inGameName?.split('-')[0])
    || currentPlayerName
    || channelPlayer?.name
    || 'You';

  const proxied = remapImageUrl(toAvatarUrl(avatarMediaUrl) ?? undefined);
  const ring = getClassColor(avatarCharacterClass) ?? '#888';

  // Always treat ProfileModal edits as profile edits so the persistent
  // currentCharacter slice + localStorage stay in sync. RoleEditor's
  // persistCharacter additionally mirrors to channelData whenever a Discord
  // ID is present, so the in-voice lobby still updates immediately.
  const isProfileEdit = true;

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
            : <span>{(displayName || '?').charAt(0).toUpperCase()}</span>}
        </div>
        <div className="profile-modal__name">{displayName}</div>
        {canRefresh && (
          <button
            type="button"
            className="profile-modal__refresh"
            onClick={handleRefresh}
            disabled={refreshLoading}
            aria-label="Refresh character"
          >
            {refreshLoading ? (
              <span className="profile-modal__refresh-spinner" />
            ) : (
              '⟳ Refresh'
            )}
          </button>
        )}
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
