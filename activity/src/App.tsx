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
    // Gate lobby behind identity + setup
    if (view === 'lobby') {
      store.resetSpinState();
      // Try localStorage resolution if identity isn't resolved yet
      if (!store.identityResolved) {
        const guildId = store.currentGuildId;
        const savedId = localStorage.getItem(`wheelson-player-${guildId ?? 'unknown'}`);
        const players = store.channelData?.players ?? [];
        const match = savedId ? players.find(p => p.discordId === savedId) : null;
        if (match) {
          // Returning player — resolve identity from localStorage
          store.setIdentity(match.discordId ?? null, match.name);
          store.setIdentityResolved(true);
          // Check if setup is complete
          if (!isPlayerReady(match)) {
            view = 'setup' as ViewName;
          }
          // else: stay on lobby (fully set up returning player)
        } else {
          view = 'identity' as ViewName;
        }
      } else {
        const me = store.channelData?.players?.find(p => p.discordId === store.currentPlayerId);
        if (me && !isPlayerReady(me)) {
          view = 'setup' as ViewName;
        }
      }
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
        s.resetSpinState();
        const s2 = useAppStore.getState();
        if (!s2.identityResolved) {
          const guildId = s2.currentGuildId;
          const savedId = localStorage.getItem(`wheelson-player-${guildId ?? 'unknown'}`);
          const players = s2.channelData?.players ?? [];
          const match = savedId ? players.find(p => p.discordId === savedId) : null;
          if (match) {
            s2.setIdentity(match.discordId ?? null, match.name);
            s2.setIdentityResolved(true);
            if (!isPlayerReady(match)) {
              view = 'setup' as ViewName;
              history.replaceState({ view }, '', viewToRoute(view, s2.currentGuildId));
            }
          } else {
            view = 'identity' as ViewName;
            history.replaceState({ view }, '', viewToRoute(view, s2.currentGuildId));
          }
        } else {
          const me = s2.channelData?.players?.find(p => p.discordId === s2.currentPlayerId);
          if (me && !isPlayerReady(me)) {
            view = 'setup' as ViewName;
            history.replaceState({ view }, '', viewToRoute(view, s2.currentGuildId));
          }
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
