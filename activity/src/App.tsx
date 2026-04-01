import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from './store/store';
import { useGuildSubscription, useChannelSubscription } from './hooks/useSession';
import { useRecentGuilds } from './hooks/useRecentGuilds';
import { statusToView, routeToView, viewToRoute } from './lib/routing';
import type { ViewName } from './store/types';
import { isPlayerReady } from './lib/roles';
import { Layout } from './components/Layout';
import { HomeView } from './views/HomeView';
import { ChannelsView } from './views/ChannelsView';
import { IdentityView } from './views/IdentityView';
import { SetupView } from './views/SetupView';
import { LobbyView } from './views/LobbyView';
import { WheelsView } from './views/WheelsView';
import { ResultsView } from './views/ResultsView';

/**
 * Gate lobby navigation behind identity + setup.
 * Tries localStorage for returning players, redirects to identity/setup if needed.
 * Returns the actual view to navigate to.
 */
function resolveLobbyGate(): ViewName {
  const store = useAppStore.getState();
  store.resetSpinState();

  if (!store.identityResolved) {
    const guildId = store.currentGuildId;
    const savedId = localStorage.getItem(`wheelson-player-${guildId ?? 'unknown'}`);
    const players = store.channelData?.players ?? [];
    const match = savedId ? players.find(p => p.discordId === savedId) : null;
    if (match) {
      store.setIdentity(match.discordId ?? null, match.name);
      store.setIdentityResolved(true);
      return isPlayerReady(match) ? 'lobby' : 'setup';
    }
    return 'identity';
  }

  const me = store.channelData?.players?.find(p => p.discordId === store.currentPlayerId);
  if (me && !isPlayerReady(me)) return 'setup';
  return 'lobby';
}

export function App() {
  const currentView = useAppStore((s) => s.currentView);
  const currentGuildId = useAppStore((s) => s.currentGuildId);
  const channelData = useAppStore((s) => s.channelData);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const guildData = useAppStore((s) => s.guildData);
  const { saveRecentGuild } = useRecentGuilds();

  // Subscribe to guild and channel Firestore docs
  useGuildSubscription();
  useChannelSubscription();

  // Save recent guilds when guild data arrives
  const savedGuildRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentGuildId && guildData?.guildName && !isDemoMode && /^\d+$/.test(currentGuildId)) {
      if (savedGuildRef.current !== currentGuildId) {
        savedGuildRef.current = currentGuildId;
        saveRecentGuild(currentGuildId, guildData.guildName, guildData.guildIconUrl);
      }
    }
  }, [currentGuildId, guildData?.guildName, guildData?.guildIconUrl, isDemoMode, saveRecentGuild]);

  const navigateTo = useCallback((view: ViewName, opts?: { replace?: boolean }) => {
    const store = useAppStore.getState();

    // Tear down
    if (view === 'home') {
      store.resetSession();
    }
    if (view === 'channels') {
      store.setChannelId(null);
      store.setChannelData(null);
      store.resetSpinState();
      store.setIdentityResolved(false);
    }
    if (view === 'lobby') {
      view = resolveLobbyGate();
    }

    store.setView(view);
    store.setStatusMessage('');

    // URL sync
    const guildId = view === 'home' ? null : useAppStore.getState().currentGuildId;
    const route = viewToRoute(view, guildId);
    if (opts?.replace) {
      history.replaceState({ view }, '', route);
    } else {
      history.pushState({ view }, '', route);
    }
  }, []);

  // Auto-navigate based on Firestore channel status
  useEffect(() => {
    if (isDemoMode || !channelData || !useAppStore.getState().currentChannelId) return;
    const targetView = statusToView(channelData.status);
    if (useAppStore.getState().currentView !== targetView) {
      navigateTo(targetView, { replace: true });
    }
  }, [channelData?.status, isDemoMode, navigateTo]);

  // Browser back/forward navigation
  useEffect(() => {
    const handler = () => {
      const parsed = routeToView(location.hash || '#/');
      let view = parsed.view;
      const store = useAppStore.getState();

      // Intercept navigation away from synchronized views (wheels/results)
      // with a confirmation prompt, unless in demo mode
      const syncedViews: ViewName[] = ['wheels', 'results'];
      if (
        syncedViews.includes(store.currentView) &&
        !syncedViews.includes(view) &&
        !store.isDemoMode
      ) {
        // Push the URL back to prevent the navigation
        const currentRoute = viewToRoute(store.currentView, store.currentGuildId);
        history.pushState({ view: store.currentView }, '', currentRoute);
        store.setPendingBrowserBack(true);
        return;
      }

      let guildChanged = false;
      if (parsed.guildId && parsed.guildId !== store.currentGuildId && view !== 'home') {
        guildChanged = true;
        store.setChannelId(null);
        store.setChannelData(null);
        store.setGuildId(parsed.guildId);
      }

      if (view === store.currentView && !guildChanged) return;

      if ((view === 'wheels' || view === 'results') && !store.channelData?.groups?.length) {
        view = store.currentGuildId ? 'channels' : 'home';
        history.replaceState({ view }, '', viewToRoute(view, store.currentGuildId));
      }

      // Don't push — browser already changed URL
      const s = useAppStore.getState();
      if (view === 'home') s.resetSession();
      if (view === 'channels') {
        s.setChannelId(null);
        s.setChannelData(null);
        s.resetSpinState();
        s.setIdentityResolved(false);
      }
      if (view === 'lobby') {
        view = resolveLobbyGate();
        if (view !== 'lobby') {
          history.replaceState({ view }, '', viewToRoute(view, useAppStore.getState().currentGuildId));
        }
      }
      s.setView(view);
      s.setStatusMessage('');
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const handleNavigateHome = useCallback(() => {
    navigateTo('home');
  }, [navigateTo]);

  return (
    <Layout onNavigateHome={handleNavigateHome}>
      {currentView === 'home' && <HomeView onNavigate={navigateTo} />}
      {currentView === 'channels' && <ChannelsView onNavigate={navigateTo} />}
      {currentView === 'identity' && <IdentityView onNavigate={navigateTo} />}
      {currentView === 'setup' && <SetupView onNavigate={navigateTo} />}
      {currentView === 'lobby' && <LobbyView onNavigate={navigateTo} />}
      {currentView === 'wheels' && <WheelsView onNavigate={navigateTo} />}
      {currentView === 'results' && <ResultsView onNavigate={navigateTo} />}
    </Layout>
  );
}
