// Sentry init must run before any other module so uncaught module-level
// errors during bootstrap are captured.
import { initSentry, Sentry, reportError } from './lib/sentry';
initSentry();

// Remove the Blizzard render-cache service worker that older builds installed:
// deleting sw.js alone leaves existing registrations running and serving their
// cached portraits. Safe to delete once clients have loaded a build with this.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
    .then(() => caches.delete('bnet-renders-v1'))
    .catch((err) => {
      reportError(err, { tag: 'sw.unregister' });
    });
}

// Discord SDK must be imported first — it patches fetch/WebSocket for the
// embedded activity proxy before Firebase opens any connections.
import './discordSdk';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useAppStore } from './store/store';
import { setupDiscordSdk } from './discordSdk';
import { migrateLegacyStorage } from './lib/storedDiscordId';
import { splitPlayers } from './lib/profiles';
import { statusToView, routeToView } from './lib/routing';
import { isPlayerReady } from './lib/roles';
import type { ChannelData, GuildData, WoWPlayer } from './types';
import './index.css';

// ── Pre-render initialization ──────────────────────────────

/**
 * Load a `?data=` test fixture's channel. Fixtures describe the lobby as a
 * `players` list (what the screens show); it is split into the lobby doc's
 * `members` and the preferences docs, as Firestore would deliver them.
 */
function loadFixtureChannel(raw: ChannelData & { players?: WoWPlayer[] }): ChannelData {
  const { players, ...channel } = raw;
  const store = useAppStore.getState();
  if (players) {
    const { members, profiles } = splitPlayers(players);
    store.setProfiles(profiles);
    channel.members = members;
  }
  store.setChannelData(channel);
  return channel;
}

async function init() {
  // Migrate legacy localStorage keys before any code reads
  // wheelson-discord-id (e.g. resolveLobbyGate in App.tsx).
  migrateLegacyStorage();
  const urlParams = new URLSearchParams(window.location.search);

  // Check for injected mock data (testing via ?data=)
  const dataParam = urlParams.get('data');
  if (dataParam) {
    try {
      const json = atob(dataParam);
      const data = JSON.parse(json);
      const store = useAppStore.getState();

      if (data.isDemoMode) {
        store.setDemoMode(true);
      }

      if (data.guild && data.channel) {
        store.setGuildData(data.guild);
        const view = statusToView((data.channel as ChannelData).status);
        store.setView(view);
        loadFixtureChannel(data.channel);
      } else if ('voiceChannels' in data && !('status' in data)) {
        store.setGuildData(data as GuildData);
        store.setView('channels');
      } else {
        const cd = loadFixtureChannel(data);
        // If identity is injected, use statusToView; otherwise gate to identity for lobby
        if (data.identity) {
          let view = statusToView(cd.status);
          // Gate lobby behind setup when player isn't ready
          if (view === 'lobby') {
            const me = useAppStore.getState().players.find(p => p.discordId === data.identity.id);
            if (me && !isPlayerReady(me)) {
              view = 'setup';
            }
          }
          store.setView(view);
        } else {
          const view = statusToView(cd.status);
          store.setView(view === 'lobby' ? 'identity' : view);
        }
      }

      // Support test identity injection (e.g. { identity: { id, name } })
      if (data.identity) {
        store.setIdentity(data.identity.id, data.identity.name);
        store.setIdentityResolved(true);
      }

      // Support test groupCards injection (e.g. { groupCards: [{ group, index }] })
      if (data.groupCards) {
        for (const card of data.groupCards) {
          store.addGroupCard(card);
        }
      }

      render();
      return;
    } catch (e) {
      reportError(e, { tag: 'init.dataParam' });
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
    } else {
      console.warn('[Wheelson] Discord SDK returned null context');
    }
  }

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
  createRoot(root).render(
    <Sentry.ErrorBoundary
      fallback={
        <div style={{ padding: '2rem', color: '#fff', background: '#1a1a1a', minHeight: '100vh' }}>
          <h1>Something went wrong.</h1>
          <p>The error has been reported. Please refresh to try again.</p>
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>,
  );
}

init().catch((err) => {
  reportError(err, { tag: 'init.fatal' });
  // Render anyway so the Sentry.ErrorBoundary fallback has a chance to
  // show instead of leaving the user with a blank screen.
  render();
});
