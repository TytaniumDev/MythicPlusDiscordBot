import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { ChannelCard } from '../components/ChannelCard';

interface ChannelsViewProps {
  onNavigate: (view: 'lobby', opts?: { replace?: boolean }) => void;
}

export function ChannelsView({ onNavigate }: ChannelsViewProps) {
  const guildData = useAppStore((s) => s.guildData);
  const currentGuildId = useAppStore((s) => s.currentGuildId);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const service = useSessionService();
  const channels = guildData?.voiceChannels || [];

  // Auto-refresh voice channels once when the view loads with empty channels
  const hasAutoRefreshed = useRef(false);
  useEffect(() => {
    if (!hasAutoRefreshed.current && guildData && channels.length === 0 && currentGuildId) {
      hasAutoRefreshed.current = true;
      service.refreshChannels(currentGuildId).catch(() => {});
    }
  }, [guildData, channels.length, currentGuildId, service]);

  const handleRefresh = useCallback(async () => {
    if (!currentGuildId) return;
    try {
      await service.refreshChannels(currentGuildId);
    } catch {
      // Silently fail
    }
  }, [currentGuildId, service]);

  const handleSelectChannel = useCallback(async (channelId: string, channelName: string) => {
    const store = useAppStore.getState();

    if (isDemoMode) {
      store.setChannelId(channelId);
      await service.selectChannel(channelId, channelName, currentGuildId || 'demo-guild');
      onNavigate('lobby');
      return;
    }

    store.setChannelId(channelId);

    try {
      await service.selectChannel(channelId, channelName, currentGuildId || '');
    } catch (err) {
      console.error('[Wheelson] Failed to create channel doc:', err);
      store.setStatusMessage('Failed to start session. Please try again.');
      return;
    }

    // Subscribe to channel (handled by useChannelSubscription effect)
    onNavigate('lobby');
  }, [isDemoMode, currentGuildId, service, onNavigate]);

  return (
    <div className="main-layout">
      <main className="content-area">
        <section id="view-channels">
          <h2>Select a Voice Channel</h2>
          <button
            id="refresh-channels-btn"
            className="btn btn-secondary btn-refresh"
            aria-label="Refresh channel list"
            onClick={handleRefresh}
          >
            Refresh channels
          </button>
          <div id="channel-list">
            {channels.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                No voice channels found.
              </div>
            )}
            {channels.map((ch) => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                onClick={() => handleSelectChannel(ch.id, ch.name)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
