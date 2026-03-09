import { useCallback, useSyncExternalStore } from 'react';
import { RecentGuild } from '../types';

const RECENT_GUILDS_KEY = 'wheelson-recent-guilds';
const MAX_RECENT_GUILDS = 10;

let listeners: (() => void)[] = [];

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function getSnapshot(): string {
  return localStorage.getItem(RECENT_GUILDS_KEY) || '[]';
}

function parseGuilds(raw: string): RecentGuild[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as RecentGuild[])
      .filter((g) => g.guildId && g.guildName && typeof g.lastVisited === 'number')
      .sort((a, b) => b.lastVisited - a.lastVisited);
  } catch {
    return [];
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function useRecentGuilds() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const guilds = parseGuilds(raw);

  const saveRecentGuild = useCallback((guildId: string, guildName: string, guildIconUrl?: string) => {
    const current = parseGuilds(getSnapshot()).filter((g) => g.guildId !== guildId);
    current.unshift({ guildId, guildName, guildIconUrl, lastVisited: Date.now() });
    if (current.length > MAX_RECENT_GUILDS) current.length = MAX_RECENT_GUILDS;
    localStorage.setItem(RECENT_GUILDS_KEY, JSON.stringify(current));
    emitChange();
  }, []);

  return { guilds, saveRecentGuild };
}
