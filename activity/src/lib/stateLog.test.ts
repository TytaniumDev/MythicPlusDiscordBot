import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../store/store';
import type { ChannelData } from '../types';
import { describeStateChanges, watchStateForLogs } from './stateLog';

const base = useAppStore.getState();

function lobby(status: ChannelData['status'], memberCount: number): ChannelData {
  return {
    channelId: '2001',
    channelName: '',
    guildId: '1001',
    status,
    members: Array.from({ length: memberCount }, (_, i) => ({ discordId: `${i}`, name: `p${i}` })),
    groups: [],
    isDebug: false,
    createdAt: null,
    lastActive: null,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  useAppStore.getState().resetSession();
  useAppStore.getState().setView('home');
});

describe('describeStateChanges', () => {
  it('reports nothing when nothing it follows changed', () => {
    expect(describeStateChanges(base, { ...base })).toEqual([]);
  });

  it('describes a screen change', () => {
    expect(describeStateChanges(base, { ...base, currentView: 'lobby' }))
      .toEqual([{ message: 'screen: home → lobby' }]);
  });

  it("describes the lobby's status and roster", () => {
    const opened = { ...base, channelData: lobby('lobby', 2) };
    expect(describeStateChanges(base, opened).map((c) => c.message))
      .toEqual(['lobby status: none → lobby', 'lobby members: 0 → 2']);
    expect(describeStateChanges(opened, { ...base, channelData: lobby('spinning', 3) }).map((c) => c.message))
      .toEqual(['lobby status: lobby → spinning', 'lobby members: 2 → 3']);
  });

  it("follows the round's groups and reveal", () => {
    const spinning = { ...base, channelData: { ...lobby('spinning', 4), groups: [{} as never, {} as never] } };
    expect(describeStateChanges(base, spinning).map((c) => c.message)).toContain('round groups: 0 → 2');
    const revealed = { ...spinning, channelData: { ...spinning.channelData, revealedGroups: 2 } };
    expect(describeStateChanges(spinning, revealed).map((c) => c.message)).toEqual(['revealed groups: 0 → 2']);
  });

  it('says when my player is set or switched, without the ID', () => {
    const picked = { ...base, currentPlayerId: '1' };
    expect(describeStateChanges(base, picked)).toEqual([{ message: 'my player: none → set' }]);
    expect(describeStateChanges(picked, { ...base, currentPlayerId: '2' })).toEqual([{ message: 'my player: switched' }]);
  });

  it('says whether the guild and channel are set, without their IDs', () => {
    const messages = describeStateChanges(base, { ...base, currentGuildId: '1001', currentChannelId: '2001' })
      .map((c) => c.message);
    expect(messages).toEqual(['guild: none → set', 'channel: none → set']);
  });

  it('warns when the connection drops', () => {
    const lost = { ...base, connectionLost: true };
    expect(describeStateChanges(base, lost)).toEqual([{ message: 'connection: lost', warn: true }]);
    expect(describeStateChanges(lost, base)).toEqual([{ message: 'connection: back' }]);
  });

  it('logs a new status message, but not one being cleared', () => {
    const failed = { ...base, statusMessage: 'Failed to open the lobby.' };
    expect(describeStateChanges(base, failed)).toEqual([{ message: 'status message: "Failed to open the lobby."' }]);
    expect(describeStateChanges(failed, base)).toEqual([]);
  });
});

describe('watchStateForLogs', () => {
  it('logs store changes until stopped', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const stop = watchStateForLogs();
    useAppStore.getState().setView('connecting');
    stop();
    useAppStore.getState().setView('lobby');
    expect(info).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith('[Wheelson] [state] screen: home → connecting');
  });

  it('logs how long the first lobby took to load, once', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const stop = watchStateForLogs();
    useAppStore.getState().setChannelData(lobby('lobby', 1));
    useAppStore.getState().setChannelData(lobby('lobby', 2));
    stop();
    const loaded = info.mock.calls.filter(([line]) => String(line).includes('first lobby loaded'));
    expect(loaded).toHaveLength(1);
  });
});
