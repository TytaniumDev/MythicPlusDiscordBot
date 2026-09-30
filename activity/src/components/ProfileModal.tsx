import { useCallback } from 'react';
import { getClassColor } from '../lib/classColors';
import { CharacterImage } from './CharacterImage';
import { RoleEditor } from './RoleEditor';
import { DiscordSignInButton } from './DiscordSignInButton';
import { Divider } from './ui';
import { useCharacterLookup } from '../hooks/useCharacterLookup';
import { useSessionService } from '../hooks/useSession';
import { useMyProfile } from '../hooks/useMyProfile';
import { useAppStore } from '../store/store';
import { parseInGameName, DEFAULT_REGION } from '@mythicplus/shared';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onOpenConnections: () => void;
}

/**
 * The current user's profile, edited straight into their preferences doc.
 * Every screen showing the player (this modal, the avatar, everyone's lobby)
 * follows that doc, so there is nothing to keep in sync by hand.
 */
export function ProfileModal({ open, onClose, onOpenConnections }: ProfileModalProps) {
  const { discordId, player, displayName } = useMyProfile();
  const verifiedDiscordId = useAppStore((s) => s.verifiedDiscordId);
  const inGameName = player?.inGameName ?? '';

  const { lookup, loading: refreshLoading } = useCharacterLookup();
  const service = useSessionService();

  const handleRefresh = useCallback(async () => {
    const parsed = parseInGameName(inGameName);
    if (!parsed || !discordId) return;

    const result = await lookup(parsed.name, parsed.realmSlug, DEFAULT_REGION, { forceRefresh: true, silent: true });
    if (result.status !== 'found') return;

    await service.saveLinkedCharacter(
      discordId,
      { name: parsed.name, realm: parsed.realmSlug, region: DEFAULT_REGION },
      result.character.mediaUrl,
      result.character.class,
    );
  }, [inGameName, discordId, lookup, service]);

  // Show refresh only when there's a valid character name (has realm component)
  const canRefresh = !!discordId && !!parseInGameName(inGameName);

  if (!open) return null;

  const shownName = displayName || 'You';
  const ring = getClassColor(player?.characterClass ?? null) ?? '#888';

  return (
    <div className="profile-modal__backdrop" onClick={onClose}>
      <div
        className="profile-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Profile"
      >
        <div className="profile-modal__avatar" style={{ borderColor: ring }}>
          <CharacterImage
            mediaUrl={player?.mediaUrl ?? null}
            variant="avatar"
            fallback={<span>{shownName.charAt(0).toUpperCase()}</span>}
          />
        </div>
        <div className="profile-modal__name">{shownName}</div>
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
        {discordId && discordId === verifiedDiscordId && (
          <div className="profile-modal__field">
            <span className="profile-modal__label">Discord</span>
            <span className="profile-modal__verified">✓ Signed in</span>
          </div>
        )}
        <DiscordSignInButton />

        <Divider />

        <div className="profile-modal__editor">
          {player ? (
            <RoleEditor player={player} />
          ) : (
            <p className="profile-modal__hint">Pick yourself in a lobby to set up your profile.</p>
          )}
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
