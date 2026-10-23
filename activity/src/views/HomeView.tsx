import { useAppStore } from '../store/store';
import { getSessionService } from '../hooks/useSession';
import { HeaderBar } from '../components/HeaderBar';
import { HeaderProfileSlot } from '../components/HeaderProfileSlot';
import { PrimaryCTA } from '../components/ui';
import { mockChannelData, mockGuildData } from '../lib/mockData';

interface HomeViewProps {
  onNavigate: (view: 'lobby', opts?: { replace?: boolean }) => void;
}

/**
 * The page outside Discord. Real lobbies only open inside the Discord
 * activity, so this offers the demo.
 */
export function HomeView({ onNavigate }: HomeViewProps) {
  const startDemo = async () => {
    const store = useAppStore.getState();
    store.setDemoMode(true);
    store.setGuildId('demo-guild');
    store.setGuildData(mockGuildData);
    // Clear identity so the guided flow (identity → setup → lobby) shows fresh
    store.resetIdentity();
    localStorage.removeItem('wheelson-player-demo-guild');
    store.setChannelId(mockChannelData.channelId);
    await getSessionService(true).selectChannel(mockChannelData.channelId, mockChannelData.channelName, 'demo-guild');
    onNavigate('lobby');
  };

  return (
    <div className="main-layout">
      <HeaderBar
        title="Wheelson"
        className="app-header"
        avatar={<HeaderProfileSlot />}
      />
      <main className="content-area">
        <section id="view-home">
          <p id="home-discord-hint" className="empty-message">
            Open Wheelson from a voice channel in Discord to start a lobby.
          </p>
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
