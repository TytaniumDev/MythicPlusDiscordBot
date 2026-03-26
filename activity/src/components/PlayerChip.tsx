import { WoWPlayer } from '../types';
import { getPrimaryRole, formatRoleName, getRoleTags, isPlayerReady } from '../lib/roles';
import { useAppStore } from '../store/store';

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

interface PlayerChipProps {
  player: WoWPlayer;
}

export function PlayerChip({ player }: PlayerChipProps) {
  const sittingOut = useAppStore((s) => s.channelData?.sittingOut) ?? [];
  const roleKey = getPrimaryRole(player);
  const roleName = formatRoleName(roleKey);
  const tags = getRoleTags(player);

  const activePlayer = useAppStore((s) => s.activePlayer);
  const isSelected = activePlayer != null && player.discordId === activePlayer.discordId;
  const isSittingOut = player.discordId != null && sittingOut.includes(player.discordId);
  const ready = isPlayerReady(player);

  const handleClick = () => {
    useAppStore.getState().setActivePlayer(player);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`player-chip${isSelected ? ' is-selected' : ''}${isSittingOut ? ' sitting-out' : ''}${!ready && !isSittingOut ? ' not-ready' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${player.name} roles`}
    >
      {ready && <ReadyIcon />}
      {!ready && !isSittingOut && <NotReadyIcon />}
      <div className="chip-header">
        <span
          className={`role-dot ${roleKey}`}
          role="img"
          aria-label={roleName}
          title={roleName}
        />
        <span>{player.name}</span>
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
