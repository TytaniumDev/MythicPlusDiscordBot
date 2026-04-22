import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { reportError } from '../lib/sentry';
import { ChannelCard } from '../components/ChannelCard';
import { HeaderBar } from '../components/HeaderBar';
import { SecondaryButton } from '../components/ui';

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
  </svg>
);

interface ChannelsViewProps {
  onNavigate: (view: 'lobby' | 'home' | 'channels', opts?: { replace?: boolean }) => void;
}

export function ChannelsView({ onNavigate }: ChannelsViewProps) {
  const guildData = useAppStore((s) => s.guildData);
  const currentGuildId = useAppStore((s) => s.currentGuildId);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const service = useSessionService();
  const channels = guildData?.voiceChannels || [];

  const hasAutoRefreshed = useRef(false);
  const hasGuildData = guildData != null;
  const channelsCount = channels.length;
  useEffect(() => {
    if (!hasAutoRefreshed.current && hasGuildData && channelsCount === 0 && currentGuildId) {
      hasAutoRefreshed.current = true;
      service.refreshChannels(currentGuildId).catch((err) => reportError(err, { tag: 'ChannelsView.autoRefresh' }));
    }
  }, [hasGuildData, channelsCount, currentGuildId, service]);

  const handleRefresh = useCallback(async () => {
    if (!currentGuildId) return;
    try {
      await service.refreshChannels(currentGuildId);
    } catch (err) {
      reportError(err, { tag: 'ChannelsView.refresh' });
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
      reportError(err, { tag: 'ChannelsView.selectChannel' });
      store.setStatusMessage('Failed to start session. Please try again.');
      return;
    }

    onNavigate('lobby');
  }, [isDemoMode, currentGuildId, service, onNavigate]);

  return (
    <div className="main-layout">
      <HeaderBar
        title="Select a Voice Channel"
        onBack={() => onNavigate('home')}
        onTitleClick={() => onNavigate('home')}
        className="app-header"
      />
      <main className="content-area">
        <section id="view-channels">
          <SecondaryButton
            id="refresh-channels-btn"
            className="btn-refresh"
            icon={<RefreshIcon />}
            aria-label="Refresh channel list"
            onClick={handleRefresh}
          >
            Refresh channels
          </SecondaryButton>
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
