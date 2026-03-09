import { VoiceChannel } from '../types';

interface ChannelCardProps {
  channel: VoiceChannel;
  onClick: () => void;
}

export function ChannelCard({ channel, onClick }: ChannelCardProps) {
  return (
    <div
      className={`channel-card${channel.userCount === 0 ? ' channel-empty' : ''}`}
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
      <span className="channel-name">{channel.name}</span>
      <span className="channel-count">
        {channel.userCount === 0 ? 'Empty' : `${channel.userCount} ${channel.userCount === 1 ? 'user' : 'users'}`}
      </span>
    </div>
  );
}
