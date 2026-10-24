import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import type { ChannelData } from '../types';

const mocks = vi.hoisted(() => ({
  instanceId: 'i-1' as string | null,
  participants: [] as { id: string }[],
  participantsListener: null as ((participants: { id: string }[]) => void) | null,
  syncLobbyMembers: vi.fn(),
}));
vi.mock('../discordSdk', () => ({
  activityInstanceId: () => mocks.instanceId,
  getParticipants: () => Promise.resolve(mocks.participants),
  onParticipantsChange: (listener: (participants: { id: string }[]) => void) => {
    mocks.participantsListener = listener;
    return () => { mocks.participantsListener = null; };
  },
}));
vi.mock('../services/lobbyMembers', () => ({ syncLobbyMembers: mocks.syncLobbyMembers }));

import { useLobbySync } from './useLobbySync';
import { useAppStore } from '../store/store';
import { SYNC_STAGGER_MS } from '../lib/lobbySync';

const CHANNEL = '2001';

function lobby(memberIds: string[], instanceId = 'i-1'): ChannelData {
  return {
    channelId: CHANNEL,
    channelName: '',
    guildId: '1001',
    status: 'lobby',
    members: memberIds.map((discordId) => ({ discordId, name: `P${discordId}` })),
    instanceId,
    groups: [],
    isDebug: false,
    createdAt: null,
    lastActive: null,
  };
}

async function start(memberIds: string[], participantIds: string[], me: string | null, instanceId = 'i-1') {
  mocks.participants = participantIds.map((id) => ({ id }));
  useAppStore.getState().setChannelId(CHANNEL);
  useAppStore.getState().setChannelData(lobby(memberIds, instanceId));
  if (me) useAppStore.getState().setIdentity(me, `P${me}`);
  renderHook(() => useLobbySync());
  // Let getParticipants resolve.
  await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.instanceId = 'i-1';
  mocks.syncLobbyMembers.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useAppStore.getState().resetSession();
});

describe('useLobbySync', () => {
  it('asks at once when this client has the lowest ID and the roster is behind', async () => {
    await start(['10'], ['10', '20'], '10');
    act(() => { vi.advanceTimersByTime(0); });
    expect(mocks.syncLobbyMembers).toHaveBeenCalledWith(CHANNEL, 'i-1');
  });

  it('stands down when the roster catches up while it waits its turn', async () => {
    await start(['10'], ['10', '20'], '20');
    act(() => { vi.advanceTimersByTime(SYNC_STAGGER_MS - 1); });
    act(() => useAppStore.getState().setChannelData(lobby(['10', '20'])));
    act(() => { vi.advanceTimersByTime(SYNC_STAGGER_MS); });
    expect(mocks.syncLobbyMembers).not.toHaveBeenCalled();
  });

  it('asks when someone opens the activity', async () => {
    await start(['10'], ['10'], '10');
    act(() => { vi.advanceTimersByTime(0); });
    expect(mocks.syncLobbyMembers).not.toHaveBeenCalled();

    act(() => mocks.participantsListener?.([{ id: '10' }, { id: '30' }]));
    act(() => { vi.advanceTimersByTime(0); });
    expect(mocks.syncLobbyMembers).toHaveBeenCalledOnce();
  });

  it('asks for a roster left from an earlier run of the activity', async () => {
    await start(['10'], ['10'], '10', 'i-old');
    act(() => { vi.advanceTimersByTime(0); });
    expect(mocks.syncLobbyMembers).toHaveBeenCalledOnce();
  });

  it('asks only once for the same state', async () => {
    await start(['10'], ['10', '20'], '10');
    act(() => { vi.advanceTimersByTime(0); });
    act(() => useAppStore.getState().setChannelData({ ...lobby(['10']) }));
    act(() => { vi.advanceTimersByTime(10 * SYNC_STAGGER_MS); });
    expect(mocks.syncLobbyMembers).toHaveBeenCalledOnce();
  });

  it('does nothing outside Discord', async () => {
    mocks.instanceId = null;
    await start([], ['10'], '10');
    act(() => { vi.advanceTimersByTime(10 * SYNC_STAGGER_MS); });
    expect(mocks.syncLobbyMembers).not.toHaveBeenCalled();
  });
});
