import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import type { ChannelData } from '../types';

const mocks = vi.hoisted(() => ({
  instanceId: 'i-1' as string | null,
  syncLobbyMembers: vi.fn(),
  reportError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));
vi.mock('../discordSdk', () => ({
  activityInstanceId: () => mocks.instanceId,
}));
vi.mock('../services/lobbyMembers', () => ({ syncLobbyMembers: mocks.syncLobbyMembers }));
vi.mock('../lib/sentry', () => ({ reportError: mocks.reportError }));
vi.mock('../lib/log', () => ({ logInfo: mocks.logInfo, logWarn: mocks.logWarn }));

import { SYNC_INTERVAL_MS, useLobbySync } from './useLobbySync';
import { useAppStore } from '../store/store';

const CHANNEL = '2001';

function lobby(status: ChannelData['status'] = 'lobby'): ChannelData {
  return {
    channelId: CHANNEL,
    channelName: '',
    guildId: '1001',
    status,
    members: [],
    instanceId: undefined,
    groups: [],
    isDebug: false,
    createdAt: null,
    lastActive: null,
  };
}

function start(status: ChannelData['status'] = 'lobby') {
  useAppStore.getState().setChannelId(CHANNEL);
  useAppStore.getState().setChannelData(lobby(status));
  renderHook(() => useLobbySync());
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.instanceId = 'i-1';
  mocks.syncLobbyMembers.mockReset().mockResolvedValue(undefined);
  mocks.reportError.mockReset();
  mocks.logInfo.mockReset();
  mocks.logWarn.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useAppStore.getState().resetSession();
});

describe('useLobbySync', () => {
  it('asks as soon as the lobby opens', () => {
    start();
    expect(mocks.syncLobbyMembers).toHaveBeenCalledOnce();
    expect(mocks.syncLobbyMembers).toHaveBeenCalledWith(CHANNEL, 'i-1');
  });

  it('asks again on an interval while players gather', () => {
    start();
    act(() => { vi.advanceTimersByTime(2 * SYNC_INTERVAL_MS); });
    expect(mocks.syncLobbyMembers).toHaveBeenCalledTimes(3);
  });

  it('asks once on opening, but not on an interval, once a round has started', () => {
    start('spinning');
    act(() => { vi.advanceTimersByTime(2 * SYNC_INTERVAL_MS); });
    expect(mocks.syncLobbyMembers).toHaveBeenCalledOnce();
  });

  it('stops asking when the round starts', () => {
    start();
    act(() => useAppStore.getState().setChannelData(lobby('spinning')));
    act(() => { vi.advanceTimersByTime(2 * SYNC_INTERVAL_MS); });
    expect(mocks.syncLobbyMembers).toHaveBeenCalledOnce();
  });

  it('reports a sync that keeps failing once, until one succeeds', async () => {
    mocks.syncLobbyMembers.mockRejectedValue(new Error('unavailable'));
    start();
    await act(async () => { vi.advanceTimersByTime(2 * SYNC_INTERVAL_MS); });
    expect(mocks.reportError).toHaveBeenCalledOnce();

    mocks.syncLobbyMembers.mockResolvedValueOnce(undefined);
    await act(async () => { vi.advanceTimersByTime(SYNC_INTERVAL_MS); });
    await act(async () => { vi.advanceTimersByTime(SYNC_INTERVAL_MS); });
    expect(mocks.reportError).toHaveBeenCalledTimes(2);
  });

  it('logs the later failures in a row and the recovery', async () => {
    mocks.syncLobbyMembers.mockRejectedValue(new Error('unavailable'));
    start();
    await act(async () => { vi.advanceTimersByTime(SYNC_INTERVAL_MS); });
    expect(mocks.logWarn).toHaveBeenCalledWith('useLobbySync', 'sync failed 2 times in a row', expect.anything());

    mocks.syncLobbyMembers.mockResolvedValue(true);
    await act(async () => { vi.advanceTimersByTime(SYNC_INTERVAL_MS); });
    expect(mocks.logInfo).toHaveBeenCalledWith('useLobbySync', 'sync recovered after 2 failed');
    expect(mocks.logInfo).toHaveBeenCalledWith('useLobbySync', 'sync changed the roster');
  });

  it('keeps asking after a failed sync', async () => {
    mocks.syncLobbyMembers.mockRejectedValueOnce(new Error('unavailable'));
    start();
    await act(async () => { vi.advanceTimersByTime(SYNC_INTERVAL_MS); });
    expect(mocks.syncLobbyMembers).toHaveBeenCalledTimes(2);
  });

  it('does nothing outside Discord', () => {
    mocks.instanceId = null;
    start();
    act(() => { vi.advanceTimersByTime(2 * SYNC_INTERVAL_MS); });
    expect(mocks.syncLobbyMembers).not.toHaveBeenCalled();
    expect(mocks.logWarn).toHaveBeenCalledWith('useLobbySync', 'no Discord activity instance, so the roster will not sync');
  });
});
