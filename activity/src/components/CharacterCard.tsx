import { useState, useEffect, useId, useImperativeHandle, useRef, type Ref } from 'react';
import type { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { reportError } from '../lib/sentry';
import { CharacterStage } from './CharacterStage';
import { RoleEditor } from './RoleEditor';
import { getPrimaryRole, getRoleColor, getRoleTags, isPlayerReady } from '../lib/roles';
import { getClassColor } from '../lib/classColors';

export interface CharacterCardHandle {
  /** Open the editor (if collapsible) and bring the card into view. */
  reveal: () => void;
}

interface CharacterCardProps {
  player: WoWPlayer;
  isSittingOut: boolean;
  /** The current user's own character: headed "Your character" rather than the player's name. */
  isSelf: boolean;
  /**
   * When true (phone layout, where the card shares the scroll area with the
   * roster) the character sits in a header beside its role tags and the role
   * editor opens behind an Edit button. When false (sidebar layout) the
   * character stands in a column beside an always-open role editor.
   */
  collapsible?: boolean;
  /** Adds a close button to the header, for the card shown as a dialog. Sidebar layout only. */
  onClose?: () => void;
  ref?: Ref<CharacterCardHandle>;
}

const HIGHLIGHT_MS = 1200;

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

/**
 * A player's character in the lobby: their full-body render, whether they're
 * ready, and one-tap access to sitting out and editing their character. The
 * lobby shows the current user's own card; `CharacterCardModal` shows anyone
 * else's.
 */
export function CharacterCard({ player, isSittingOut, isSelf, collapsible = false, onClose, ref }: CharacterCardProps) {
  const service = useSessionService();
  const editorId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  // Set when Done closes the editor, so focus returns to Edit instead of
  // being dropped along with the Done button.
  const returnFocusRef = useRef(false);

  // Open the editor straight away when the character still needs a name —
  // that's the one thing blocking them from being ready.
  const [expanded, setExpanded] = useState(() => !player.inGameName);
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(false), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  useEffect(() => {
    if (expanded || !returnFocusRef.current) return;
    returnFocusRef.current = false;
    editButtonRef.current?.focus();
  }, [expanded]);

  useImperativeHandle(ref, () => ({
    reveal: () => {
      setExpanded(true);
      setHighlighted(true);
      rootRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    },
  }), []);

  const roleColor = getRoleColor(getPrimaryRole(player));

  const status = isSittingOut
    ? { label: 'Sitting out', modifier: 'out' }
    : isPlayerReady(player)
      ? { label: '✓ Ready', modifier: 'ready' }
      : { label: 'Not ready', modifier: 'warn' };

  const channelId = useAppStore((s) => s.currentChannelId);
  const toggleSitOut = () => {
    if (!channelId || !player.discordId) return;
    service.setSittingOut(channelId, player.discordId, !isSittingOut).catch((err) => {
      reportError(err, { tag: 'CharacterCard.setSittingOut' });
    });
  };

  const closeEditor = () => {
    returnFocusRef.current = true;
    setExpanded(false);
  };

  const className = [
    'character-card',
    collapsible ? 'character-card--phone' : 'character-card--sidebar',
    isSittingOut && 'character-card--out',
    !player.inGameName && 'character-card--needs-name',
    highlighted && 'character-card--highlight',
  ].filter(Boolean).join(' ');

  const stage = (
    <CharacterStage
      mediaUrl={player.mediaUrl}
      color={getClassColor(player.characterClass)}
      dimmed={isSittingOut}
      alt={`${player.inGameName ?? player.name}, full-body render`}
      // The phone card opens its editor when the name is missing, so the
      // highlighted name field already says what to do.
      caption={!collapsible && !player.inGameName
        ? (isSelf ? 'Add your in-game name to show your character' : 'Add their in-game name to show their character')
        : undefined}
    />
  );

  const title = <span className="character-card__title">{isSelf ? 'Your character' : player.name}</span>;

  const statusPill = (
    <span className={`character-card__status character-card__status--${status.modifier}`}>{status.label}</span>
  );

  // The label stays put; the switch state and the status pill say whether
  // they're sitting out.
  const sitOutToggle = (
    <button
      type="button"
      className="character-card__sit-out"
      role="switch"
      aria-checked={isSittingOut}
      onClick={toggleSitOut}
    >
      Sit out
      <span className="character-card__switch" aria-hidden="true" />
    </button>
  );

  const editor = (
    <div className="character-card__editor" id={editorId}>
      <RoleEditor player={player} />
    </div>
  );

  if (!collapsible) {
    // The editor's pressed spec and utility buttons already show the roles,
    // so the sidebar skips the role tags.
    return (
      <div
        ref={rootRef}
        className={className}
        style={{ '--mc-color': roleColor } as React.CSSProperties}
        data-testid="character-card"
      >
        <div className="character-card__eyebrow">
          {title}
          {statusPill}
          {onClose && (
            <button type="button" className="character-card__close" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          )}
        </div>
        <div className="character-card__sheet">
          <div className="character-card__figure">
            {stage}
            {sitOutToggle}
          </div>
          {editor}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ '--mc-color': roleColor } as React.CSSProperties}
      data-testid="character-card"
    >
      <div className="character-card__hero">
        {stage}
        <div className="character-card__hero-info">
          <div className="character-card__eyebrow">{title}</div>
          {statusPill}
          <div className="chip-tags">
            {getRoleTags(player).map((tag, i) => (
              <span key={i} className={`role-tag ${tag.cssClass}`}>{tag.label}</span>
            ))}
          </div>
          <div className="character-card__hero-controls">
            {sitOutToggle}
            {/* Hidden rather than removed while the editor is open, so the
                header keeps its height and the character doesn't resize. */}
            <button
              ref={editButtonRef}
              type="button"
              className={`character-card__edit${expanded ? ' character-card__edit--reserved' : ''}`}
              aria-expanded={expanded}
              aria-controls={editorId}
              inert={expanded}
              onClick={() => setExpanded(true)}
            >
              <PencilIcon />
              Edit
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <>
          {editor}
          <button
            type="button"
            className="character-card__done"
            aria-expanded="true"
            aria-controls={editorId}
            onClick={closeEditor}
          >
            Done
          </button>
        </>
      )}
    </div>
  );
}
