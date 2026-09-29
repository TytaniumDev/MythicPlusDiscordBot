import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

interface Listener {
  path: string;
  next: (snap: unknown) => void;
  unsub: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => ({
  listeners: [] as Listener[],
  setDoc: vi.fn(),
}));

vi.mock('../firebase', () => ({ db: {}, authReady: Promise.resolve() }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  // onSnapshot(ref, next, error) or onSnapshot(ref, options, next, error)
  onSnapshot: (ref: { path: string }, ...args: unknown[]) => {
    const next = (typeof args[0] === 'function' ? args[0] : args[1]) as (snap: unknown) => void;
    const unsub = vi.fn();
    mocks.listeners.push({ path: ref.path, next, unsub });
    return unsub;
  },
  setDoc: mocks.setDoc,
  serverTimestamp: () => 'now',
  collection: vi.fn(),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  increment: vi.fn(),
  runTransaction: vi.fn(),
}));

import { firestoreService } from './firestoreService';
import { useAppStore } from '../store/store';

function snapshot(data: Record<string, unknown> | null, fromCache = false) {
  return { exists: () => data !== null, data: () => data, metadata: { fromCache } };
}

function listenersOn(path: string): Listener[] {
  return mocks.listeners.filter((l) => l.path === path);
}

beforeEach(() => {
  mocks.listeners.length = 0;
  mocks.setDoc.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  firestoreService.followProfiles([]);
  useAppStore.getState().resetSession();
  useAppStore.setState({ seasonConfig: null, connectionLost: false });
});

describe('followProfiles', () => {
  it('follows each preferences doc, adding and dropping only the players that changed', () => {
    firestoreService.followProfiles(['1', '2']);
    expect(mocks.listeners.map((l) => l.path)).toEqual(['preferences/1', 'preferences/2']);
    listenersOn('preferences/1')[0].next(snapshot({ roles: ['Tank'], inGameName: 'One-Realm' }));
    listenersOn('preferences/2')[0].next(snapshot(null));

    firestoreService.followProfiles(['2', '3']);

    expect(listenersOn('preferences/1')[0].unsub).toHaveBeenCalled();
    expect(listenersOn('preferences/2')).toHaveLength(1);
    expect(listenersOn('preferences/2')[0].unsub).not.toHaveBeenCalled();
    expect(listenersOn('preferences/3')).toHaveLength(1);
    // Player 1 is gone; player 2 has no doc; player 3 is still loading.
    expect(useAppStore.getState().profiles).toEqual({ '2': null });
  });

  it('stops following everyone when given no players', () => {
    firestoreService.followProfiles(['1']);
    listenersOn('preferences/1')[0].next(snapshot({ roles: ['Healer'] }));

    firestoreService.followProfiles([]);

    expect(listenersOn('preferences/1')[0].unsub).toHaveBeenCalled();
    expect(useAppStore.getState().profiles).toEqual({});
  });
});

describe('subscribeToSeasonConfig', () => {
  it('reports the connection dropping and coming back', () => {
    firestoreService.subscribeToSeasonConfig();
    const [season] = listenersOn('config/season');
    const config = { slug: 's1', blizzardSeasonId: 1, expansionId: 11 };

    season.next(snapshot(config, false));
    expect(useAppStore.getState().connectionLost).toBe(false);
    expect(useAppStore.getState().seasonConfig).toEqual(config);

    season.next(snapshot(config, true));
    expect(useAppStore.getState().connectionLost).toBe(true);

    season.next(snapshot(config, false));
    expect(useAppStore.getState().connectionLost).toBe(false);
  });

  it('says nothing before it has ever connected', () => {
    firestoreService.subscribeToSeasonConfig();
    listenersOn('config/season')[0].next(snapshot(null, true));
    expect(useAppStore.getState().connectionLost).toBe(false);
  });
});

describe('subscribeToGuild', () => {
  const GUILD_ID = '100000000000000001';

  it('waits for the server before setting up a guild that looks missing', async () => {
    firestoreService.subscribeToGuild(GUILD_ID, null);
    const [guild] = listenersOn(`guilds/${GUILD_ID}`);

    guild.next(snapshot(null, true));
    await Promise.resolve();
    expect(mocks.setDoc).not.toHaveBeenCalled();

    guild.next(snapshot(null, false));
    await vi.waitFor(() => expect(mocks.setDoc).toHaveBeenCalledOnce());
    expect(mocks.setDoc.mock.calls[0][0]).toEqual({ path: `guilds/${GUILD_ID}` });
  });
});
