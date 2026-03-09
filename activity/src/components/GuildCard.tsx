import { RecentGuild } from '../types';
import { formatRelativeTime } from '../hooks/useRecentGuilds';

interface GuildCardProps {
  guild: RecentGuild;
  onClick: () => void;
}

export function GuildCard({ guild, onClick }: GuildCardProps) {
  return (
    <div
      className="guild-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {guild.guildIconUrl ? (
        <img className="guild-icon" src={guild.guildIconUrl} alt="" />
      ) : (
        <div className="guild-icon-placeholder" />
      )}
      <div className="guild-card-info">
        <div className="guild-card-name">{guild.guildName}</div>
        <div className="guild-last-visited">{formatRelativeTime(guild.lastVisited)}</div>
      </div>
    </div>
  );
}
