import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from './store/store';
import { useGuildSubscription, useChannelSubscription } from './hooks/useSession';
import { useRecentGuilds } from './hooks/useRecentGuilds';
import { Layout } from './components/Layout';
import { HomeView } from './views/HomeView';
import { ChannelsView } from './views/ChannelsView';
import { LobbyView } from './views/LobbyView';
import { WheelsView } from './views/WheelsView';
import { ResultsView } from './views/ResultsView';
import type { ViewName } from './store/types';

function statusToView(status: string): ViewName {
  switch (status) {
    case 'lobby':
    case 'request_spin':
      return 'lobby';
    case 'spinning':
      return 'wheels';
    case 'completed':
      return 'results';
    default:
      console.warn('[Wheelson] Unknown channel status:', status);
      return 'lobby';
  }
}

function viewToRoute(view: ViewName, guildId?: string | null): string {
  if (view === 'home' || !guildId) return '#/';
  return `#/guild/${guildId}/${view}`;
}

function routeToView(hash: string): { view: ViewName; guildId: string | null } {
  if (!hash || hash === '#/') return { view: 'home', guildId: null };
  const match = hash.match(/^#\/guild\/([\w-]+)\/(channels|lobby|wheels|results)$/);
  if (match) return { view: match[2] as ViewName, guildId: match[1] };
  return { view: 'home', guildId: null };
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

  // Auto-navigate based on Firestore channel status
  useEffect(() => {
    if (isDemoMode || !channelData || !useAppStore.getState().currentChannelId) return;
    const targetView = statusToView(channelData.status);
    if (useAppStore.getState().currentView !== targetView) {
      navigateTo(targetView, { replace: true });
    }
  }, [channelData?.status, isDemoMode]);

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
      store.resetSpinState();
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
      if (view === 'lobby') s.resetSpinState();
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
      {currentView === 'lobby' && <LobbyView onNavigate={navigateTo} />}
      {currentView === 'wheels' && <WheelsView onNavigate={navigateTo} />}
      {currentView === 'results' && <ResultsView onNavigate={navigateTo} />}
    </Layout>
  );
}
