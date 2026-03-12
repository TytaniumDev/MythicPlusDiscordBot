import { WoWPlayer } from '../types';
import { getPrimaryRole, formatRoleName, getRoleTags } from '../lib/roles';
import { useAppStore } from '../store/store';

const CheckIcon = () => (
  <svg className="claimed-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface PlayerChipProps {
  player: WoWPlayer;
}

export function PlayerChip({ player }: PlayerChipProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const claimedPlayers = useAppStore((s) => s.channelData?.claimedPlayers) ?? [];
  const roleKey = getPrimaryRole(player);
  const roleName = formatRoleName(roleKey);
  const tags = getRoleTags(player);

  const isMe = currentPlayerId && player.discordId === currentPlayerId;
  const isClaimed = player.discordId != null && claimedPlayers.includes(player.discordId);

  return (
    <div className={`player-chip${isMe ? ' is-me' : ''}`}>
      {isClaimed && <CheckIcon />}
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
