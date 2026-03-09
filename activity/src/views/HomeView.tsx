import { useAppStore } from '../store/store';
import { useRecentGuilds } from '../hooks/useRecentGuilds';
import { GuildCard } from '../components/GuildCard';
import { mockGuildData } from '../lib/mockData';

interface HomeViewProps {
  onNavigate: (view: 'channels', opts?: { replace?: boolean }) => void;
}

export function HomeView({ onNavigate }: HomeViewProps) {
  const { guilds } = useRecentGuilds();

  const handleGuildClick = (guildId: string) => {
    const store = useAppStore.getState();
    // Tear down existing subscriptions
    store.setChannelId(null);
    store.setChannelData(null);
    store.setGuildId(guildId);
    // Subscribe handled by useGuildSubscription effect
    onNavigate('channels');
  };

  const startDemo = () => {
    const store = useAppStore.getState();
    store.setDemoMode(true);
    store.setGuildId('demo-guild');
    store.setGuildData(mockGuildData);
    onNavigate('channels');
  };

  return (
    <div className="main-layout">
      <main className="content-area">
        <section id="view-home">
          <h2>Recent Guilds</h2>
          <div id="recent-guilds-list">
            {guilds.map((guild) => (
              <GuildCard
                key={guild.guildId}
                guild={guild}
                onClick={() => handleGuildClick(guild.guildId)}
              />
            ))}
          </div>
          {guilds.length === 0 && (
            <p id="no-recent-guilds" className="empty-message">
              No recent guilds. Use a direct link or start from Discord to begin.
            </p>
          )}
          <div id="demo-controls">
            <button className="btn btn-success" id="start-demo-btn" onClick={startDemo}>
              Start Demo
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
