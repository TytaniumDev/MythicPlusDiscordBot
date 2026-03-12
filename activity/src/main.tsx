// Discord SDK must be imported first — it patches fetch/WebSocket for the
// embedded activity proxy before Firebase opens any connections.
import './discordSdk';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useAppStore } from './store/store';
import { setupDiscordSdk } from './discordSdk';
import { statusToView, routeToView } from './lib/routing';
import type { ChannelData, GuildData } from './types';
import './index.css';

// ── Pre-render initialization ──────────────────────────────

async function init() {
  const urlParams = new URLSearchParams(window.location.search);

  // Check for injected mock data (testing via ?data=)
  const dataParam = urlParams.get('data');
  if (dataParam) {
    try {
      const json = atob(dataParam);
      const data = JSON.parse(json);
      const store = useAppStore.getState();

      if (data.guild && data.channel) {
        store.setGuildData(data.guild);
        const view = statusToView((data.channel as ChannelData).status);
        store.setView(view);
        store.setChannelData(data.channel);
      } else if ('voiceChannels' in data && !('status' in data)) {
        store.setGuildData(data as GuildData);
        store.setView('channels');
      } else {
        const cd = data as ChannelData;
        store.setChannelData(cd);
        const view = statusToView(cd.status);
        store.setView(view);
      }

      // Support test identity injection (e.g. { identity: { id, name } })
      if (data.identity) {
        store.setIdentity(data.identity.id, data.identity.name);
        store.setIdentityResolved(true);
      }

      render();
      return;
    } catch (e) {
      console.error('Invalid data param', e);
    }
  }

  // Resolve guild ID: URL params first, then hash route, then Discord SDK
  let currentGuildId = urlParams.get('guildId') || urlParams.get('sessionId');
  const urlChannelId = urlParams.get('channelId');
  const initialRoute = routeToView(location.hash);
  let discordChannelId: string | null = null;

  if (!currentGuildId && initialRoute.guildId) {
    currentGuildId = initialRoute.guildId;
  }

  if (!currentGuildId) {
    const discordContext = await setupDiscordSdk();
    if (discordContext) {
      currentGuildId = discordContext.guildId;
      discordChannelId = discordContext.channelId;
      console.log('[Wheelson] Discord SDK context:', discordContext);
    } else {
      console.warn('[Wheelson] Discord SDK returned null context');
    }
  }

  console.log('[Wheelson] Resolved guildId:', currentGuildId, 'channelId:', urlChannelId || discordChannelId);

  const store = useAppStore.getState();

  if (!currentGuildId) {
    store.setView('home');
    render();
    return;
  }

  store.setGuildId(currentGuildId);
  if (discordChannelId) {
    store.setDiscordChannelId(discordChannelId);
  }

  const resolvedChannelId = urlChannelId || discordChannelId;
  if (resolvedChannelId) {
    store.setChannelId(resolvedChannelId);
    store.setView('channels');
    store.setStatusMessage('Loading...');
  } else {
    if (initialRoute.guildId && (initialRoute.view === 'wheels' || initialRoute.view === 'results')) {
      console.warn('[Wheelson] Stale hash', initialRoute.view, ', redirecting to channels');
    }
    store.setView('channels');
  }

  render();
}

function render() {
  const root = document.getElementById('root');
  if (!root) return;
  createRoot(root).render(<App />);
}

init();
