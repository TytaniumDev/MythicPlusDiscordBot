import { useAppStore } from '../store/store';
import { useRecentGuilds } from '../hooks/useRecentGuilds';
import { GuildCard } from '../components/GuildCard';
import { HeaderBar } from '../components/HeaderBar';
import { HeaderProfileSlot } from '../components/HeaderProfileSlot';
import { PrimaryCTA } from '../components/ui';
import { mockGuildData } from '../lib/mockData';

interface HomeViewProps {
  onNavigate: (view: 'channels' | 'home', opts?: { replace?: boolean }) => void;
}

export function HomeView({ onNavigate }: HomeViewProps) {
  const { guilds } = useRecentGuilds();

  const handleGuildClick = (guildId: string) => {
    const store = useAppStore.getState();
    store.setChannelId(null);
    store.setChannelData(null);
    store.setGuildId(guildId);
    onNavigate('channels');
  };

  const startDemo = () => {
    const store = useAppStore.getState();
    store.setDemoMode(true);
    store.setGuildId('demo-guild');
    store.setGuildData(mockGuildData);
    // Clear identity so the guided flow (identity → setup → lobby) shows fresh
    store.resetIdentity();
    localStorage.removeItem('wheelson-player-demo-guild');
    onNavigate('channels');
  };

  return (
    <div className="main-layout">
      <HeaderBar
        title="Recent Guilds"
        className="app-header"
        avatar={<HeaderProfileSlot />}
      />
      <main className="content-area">
        <section id="view-home">
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
            <PrimaryCTA id="start-demo-btn" onClick={startDemo}>
              Start Demo
            </PrimaryCTA>
          </div>
        </section>
      </main>
    </div>
  );
}
