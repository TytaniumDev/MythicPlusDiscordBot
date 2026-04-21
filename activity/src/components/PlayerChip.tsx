import type { RoleTag } from '../lib/roles';

const ReadyIcon = () => (
  <svg className="ready-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const NotReadyIcon = () => (
  <svg className="not-ready-x" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export interface PlayerChipProps {
  /** Player display name. */
  name: string;
  /** Role key: 'tank' | 'healer' | 'ranged' | 'melee' | 'unassigned'. */
  roleKey: string;
  /** Human label for the role (used as aria/title). */
  roleLabel: string;
  /** Tags shown under the name (offspecs, utilities). */
  tags?: RoleTag[];
  /** Player is currently selected in the UI. */
  isSelected?: boolean;
  /** Player is sitting out this round. */
  isSittingOut?: boolean;
  /** Player is ready to spin (has role + WoW name). */
  isReady?: boolean;
  /** Click handler — fired from click or Enter/Space. */
  onClick?: () => void;
}

export function PlayerChip({
  name,
  roleKey,
  roleLabel,
  tags = [],
  isSelected = false,
  isSittingOut = false,
  isReady = false,
  onClick,
}: PlayerChipProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`player-chip${isSelected ? ' is-selected' : ''}${isSittingOut ? ' sitting-out' : ''}${!isReady && !isSittingOut ? ' not-ready' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${name} roles`}
    >
      {isReady && <ReadyIcon />}
      {!isReady && !isSittingOut && <NotReadyIcon />}
      <div className="chip-header">
        <span
          className={`role-dot ${roleKey}`}
          role="img"
          aria-label={roleLabel}
          title={roleLabel}
        />
        <span>{name}</span>
      </div>
      {tags.length > 0 && (
        <div className="chip-tags">
          {tags.map((tag, i) => (
            <span key={i} className={`role-tag ${tag.cssClass}`}>
              {tag.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
