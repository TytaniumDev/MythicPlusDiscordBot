import { WoWPlayer } from '../types';
import { getPrimaryRole, formatRoleName, getRoleTags } from '../lib/roles';
import { useAppStore } from '../store/store';

interface PlayerChipProps {
  player: WoWPlayer;
}

export function PlayerChip({ player }: PlayerChipProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const roleKey = getPrimaryRole(player);
  const roleName = formatRoleName(roleKey);
  const tags = getRoleTags(player);

  const isMe = currentPlayerId && player.discordId === currentPlayerId;

  const handleClick = () => {
    useAppStore.getState().setModalPlayer(player);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`player-chip${isMe ? ' is-me' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${player.name} roles`}
    >
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
