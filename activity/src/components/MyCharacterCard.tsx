import { useState, useEffect, useId, useImperativeHandle, useRef, type Ref } from 'react';
import type { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { reportError } from '../lib/sentry';
import { CharacterImage } from './CharacterImage';
import { RoleEditor } from './RoleEditor';
import { getPrimaryRole, getRoleColor, getRoleTags, isPlayerReady } from '../lib/roles';
import { getClassColor } from '../lib/classColors';

export interface MyCharacterCardHandle {
  /** Open the editor (if collapsible) and bring the card into view. */
  reveal: () => void;
}

interface MyCharacterCardProps {
  player: WoWPlayer;
  isSittingOut: boolean;
  /**
   * When true the role editor sits behind an Edit toggle (phone layout, where
   * the card shares the scroll area with the roster). When false the editor is
   * always shown (sidebar layout).
   */
  collapsible?: boolean;
  ref?: Ref<MyCharacterCardHandle>;
}

const HIGHLIGHT_MS = 1200;

/**
 * The current user's character in the lobby: who they are, whether they're
 * ready, and one-tap access to sitting out and editing their character.
 */
export function MyCharacterCard({ player, isSittingOut, collapsible = false, ref }: MyCharacterCardProps) {
  const service = useSessionService();
  const editorId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // Open the editor straight away when the character still needs a name —
  // that's the one thing blocking them from being ready.
  const [expanded, setExpanded] = useState(() => !player.inGameName);
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(false), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  useImperativeHandle(ref, () => ({
    reveal: () => {
      setExpanded(true);
      setHighlighted(true);
      rootRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    },
  }), []);

  const roleKey = getPrimaryRole(player);
  const roleColor = getRoleColor(roleKey);
  const ringColor = getClassColor(player.characterClass) ?? roleColor;
  const tags = getRoleTags(player);
  const showEditor = !collapsible || expanded;

  const status = isSittingOut
    ? { label: 'Sitting out', modifier: 'out' }
    : isPlayerReady(player)
      ? { label: '✓ Ready', modifier: 'ready' }
      : { label: 'Not ready', modifier: 'warn' };

  const channelId = useAppStore((s) => s.currentChannelId);
  const toggleSitOut = () => {
    if (!channelId || !player.discordId) return;
    service.setSittingOut(channelId, player.discordId, !isSittingOut).catch((err) => {
      reportError(err, { tag: 'MyCharacterCard.setSittingOut' });
    });
  };

  return (
    <div
      ref={rootRef}
      className={`my-character${isSittingOut ? ' my-character--out' : ''}${player.inGameName ? '' : ' my-character--needs-name'}${highlighted ? ' my-character--highlight' : ''}`}
      style={{ '--mc-color': roleColor } as React.CSSProperties}
      data-testid="my-character-card"
    >
      <div className="my-character__eyebrow">
        Your character
        <span className={`my-character__status my-character__status--${status.modifier}`}>
          {status.label}
        </span>
      </div>

      <div className="my-character__main">
        <div
          className="my-character__portrait"
          style={{ '--mc-ring': ringColor } as React.CSSProperties}
          aria-hidden="true"
        >
          <span className="my-character__portrait-letter">{player.name.charAt(0).toUpperCase() || '?'}</span>
          <CharacterImage mediaUrl={player.mediaUrl} variant="avatar" className="my-character__portrait-img" />
        </div>
        <div className="my-character__info">
          <div className="my-character__name">{player.name}</div>
          {player.inGameName ? (
            <div className="my-character__ign">{player.inGameName}</div>
          ) : (
            <div className="my-character__ign my-character__ign--missing">⚠ Add your in-game name</div>
          )}
          <div className="chip-tags">
            {tags.map((tag, i) => (
              <span key={i} className={`role-tag ${tag.cssClass}`}>{tag.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className={`my-character__actions${collapsible ? '' : ' my-character__actions--single'}`}>
        <button
          type="button"
          className="my-character__btn my-character__btn--sit-out"
          role="switch"
          aria-checked={isSittingOut}
          onClick={toggleSitOut}
        >
          <span className="my-character__switch" aria-hidden="true" />
          {isSittingOut ? 'Sitting out' : 'Sit out'}
        </button>
        {collapsible && (
          <button
            type="button"
            className="my-character__btn my-character__btn--edit"
            aria-expanded={expanded}
            aria-controls={editorId}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Done' : '✎ Edit'}
          </button>
        )}
      </div>

      {showEditor && (
        <div className="my-character__editor" id={editorId}>
          <RoleEditor player={player} hideSitOut />
        </div>
      )}
    </div>
  );
}
