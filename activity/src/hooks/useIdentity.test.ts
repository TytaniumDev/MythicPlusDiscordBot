import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ getParticipants: vi.fn() }));
vi.mock('../discordSdk', () => ({ getParticipants: mocks.getParticipants }));

import { useIdentity } from './useIdentity';
import { useAppStore } from '../store/store';
import { demoService } from '../services/demoService';
import { mockPlayers } from '../lib/mockData';
import { saveStoredDiscordId, loadStoredDiscordId } from '../lib/storedDiscordId';

const [quill, schmeebs, kitchenstink] = mockPlayers;

function resolve(players = mockPlayers) {
  const { result } = renderHook(() => useIdentity());
  return act(() => result.current.resolveIdentity(players));
}

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ isDemoMode: true });
  vi.spyOn(demoService, 'claimPlayer').mockResolvedValue();
  mocks.getParticipants.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useAppStore.getState().resetSession();
  useAppStore.setState({ verifiedDiscordId: null });
});

describe('resolveIdentity with a Discord sign-in', () => {
  it('picks the signed-in player over the remembered one', async () => {
    saveStoredDiscordId(quill.discordId);
    useAppStore.setState({ verifiedDiscordId: schmeebs.discordId });

    await resolve();

    const state = useAppStore.getState();
    expect(state.currentPlayerId).toBe(schmeebs.discordId);
    expect(state.identityResolved).toBe(true);
    expect(loadStoredDiscordId()).toBe(schmeebs.discordId);
  });

  it('does not guess when the signed-in player is not in the lobby', async () => {
    saveStoredDiscordId(quill.discordId);
    mocks.getParticipants.mockResolvedValue([
      { id: kitchenstink.discordId, nickname: kitchenstink.name, global_name: null, username: 'k' },
    ]);
    useAppStore.setState({ verifiedDiscordId: '999999999999999999' });

    await resolve();

    const state = useAppStore.getState();
    expect(state.currentPlayerId).toBeNull();
    expect(state.identityResolved).toBe(false);
    expect(mocks.getParticipants).not.toHaveBeenCalled();
  });

  it('replaces an earlier pick with the signed-in player', async () => {
    useAppStore.getState().setIdentity(quill.discordId, quill.name);
    useAppStore.getState().setIdentityResolved(true);
    useAppStore.setState({ verifiedDiscordId: schmeebs.discordId });

    await resolve();

    expect(useAppStore.getState().currentPlayerId).toBe(schmeebs.discordId);
  });

  it('keeps a pick when the signed-in player is not in the lobby', async () => {
    useAppStore.getState().setIdentity(quill.discordId, quill.name);
    useAppStore.getState().setIdentityResolved(true);
    useAppStore.setState({ verifiedDiscordId: '999999999999999999' });

    await resolve();

    expect(useAppStore.getState().currentPlayerId).toBe(quill.discordId);
    expect(useAppStore.getState().identityResolved).toBe(true);
  });

  it('keeps the remembered player when there is no sign-in', async () => {
    saveStoredDiscordId(quill.discordId);

    await resolve();

    expect(useAppStore.getState().currentPlayerId).toBe(quill.discordId);
  });
});
