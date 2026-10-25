import { useEffect } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { launchContext } from '../discordSdk';
import { reportError } from '../lib/sentry';
import { logInfo } from '../lib/log';
import { HeaderBar } from '../components/HeaderBar';
import { HeaderProfileSlot } from '../components/HeaderProfileSlot';

/**
 * Opens the lobby of the voice channel the activity runs in. An existing
 * lobby is joined as it is; App's status effect then shows it.
 */
export function ConnectingView() {
  const guildId = useAppStore((s) => s.currentGuildId);
  const channelId = useAppStore((s) => s.currentChannelId);
  const guildReady = useAppStore((s) => s.guildData !== null);
  const statusMessage = useAppStore((s) => s.statusMessage);
  const service = useSessionService();

  // Back from the home screen inside Discord: rejoin the launch channel.
  useEffect(() => {
    const launch = launchContext();
    const store = useAppStore.getState();
    if (!launch || store.currentChannelId) return;
    logInfo('ConnectingView', 'rejoining the launch channel');
    store.setGuildId(launch.guildId);
    if (launch.channelId) store.setChannelId(launch.channelId);
  }, []);

  // firestore.rules only accept a lobby for a guild doc that exists, so wait
  // for it (the guild subscription creates a missing one).
  useEffect(() => {
    if (!guildId || !channelId) return;
    if (!guildReady) {
      logInfo('ConnectingView', 'waiting for the guild doc before opening the lobby');
      return;
    }
    logInfo('ConnectingView', 'opening the lobby');
    service.selectChannel(channelId, '', guildId).then(() => {
      logInfo('ConnectingView', 'lobby open');
    }, (err) => {
      reportError(err, { tag: 'ConnectingView.selectChannel' });
      useAppStore.getState().setStatusMessage('Failed to open the lobby. Please try again.');
    });
  }, [guildReady, guildId, channelId, service]);

  const message = !channelId && !guildId
    ? 'Start Wheelson from a voice channel in Discord.'
    : statusMessage || 'Opening the lobby...';

  return (
    <div className="main-layout">
      <HeaderBar
        title="Wheelson"
        className="app-header"
        avatar={<HeaderProfileSlot />}
      />
      <main className="content-area">
        <section id="view-connecting">
          <p className="empty-message" role="status">{message}</p>
        </section>
      </main>
    </div>
  );
}
