import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act, waitFor } from '@testing-library/react';
import { parsePlayerPreferences } from '@mythicplus/shared';

const mocks = vi.hoisted(() => ({ lookupCharacter: vi.fn(), saveLinkedCharacter: vi.fn() }));
vi.mock('../services/characterLookup', () => ({ lookupCharacter: mocks.lookupCharacter }));
vi.mock('../services/firestoreService', () => ({
  firestoreService: { saveLinkedCharacter: mocks.saveLinkedCharacter },
}));

import { usePortraitRepair } from './usePortraitRepair';
import { useAppStore } from '../store/store';

const ME = '100000000000000005';
const AVATAR = 'https://render.worldofwarcraft.com/us/character/uldum/1/2-avatar.jpg';

/** A saved profile that names a character; no portrait unless given one. */
function profile(fields: Record<string, unknown> = {}) {
  return parsePlayerPreferences({ roles: ['Tank'], inGameName: 'Gazzi-Uldum', ...fields });
}

const FOUND = {
  status: 'found',
  character: { name: 'Gazzi', realm: 'Uldum', class: 'Druid', role: 'tank', utilities: [], mediaUrl: AVATAR },
};

function setMyProfile(fields?: Record<string, unknown>) {
  act(() => useAppStore.getState().setProfiles({ [ME]: profile(fields) }));
}

beforeEach(() => {
  useAppStore.setState({ currentGuildId: '900000000000000001', isDemoMode: false });
  useAppStore.getState().setIdentity(ME, 'Gazzi');
  mocks.lookupCharacter.mockResolvedValue(FOUND);
  mocks.saveLinkedCharacter.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAppStore.getState().resetSession();
});

describe('usePortraitRepair', () => {
  it('looks the character up and saves the portrait missing from its profile', async () => {
    setMyProfile();
    renderHook(() => usePortraitRepair());

    await waitFor(() => expect(mocks.saveLinkedCharacter).toHaveBeenCalledWith(
      ME,
      { name: 'Gazzi', realm: 'uldum', region: 'us' },
      AVATAR,
      'Druid',
    ));
    expect(mocks.lookupCharacter).toHaveBeenCalledWith('Gazzi', 'uldum', 'us', { forceRefresh: true });
  });

  it('waits for the profile to load', async () => {
    renderHook(() => usePortraitRepair());
    expect(mocks.lookupCharacter).not.toHaveBeenCalled();

    setMyProfile();

    await waitFor(() => expect(mocks.saveLinkedCharacter).toHaveBeenCalledOnce());
  });

  it('leaves a profile with a portrait, or without a lookup-ready name, alone', () => {
    setMyProfile({ mediaUrl: AVATAR });
    renderHook(() => usePortraitRepair());
    act(() => useAppStore.getState().setIdentity('100000000000000006', 'Other'));
    act(() => useAppStore.getState().setProfiles({ '100000000000000006': profile({ inGameName: 'Other' }) }));

    expect(mocks.lookupCharacter).not.toHaveBeenCalled();
  });

  it('tries once per session, even if the profile still has no portrait', async () => {
    mocks.lookupCharacter.mockResolvedValue({ status: 'failed' });
    setMyProfile();
    renderHook(() => usePortraitRepair());
    await waitFor(() => expect(mocks.lookupCharacter).toHaveBeenCalledOnce());

    setMyProfile({ roles: ['Healer'] });

    expect(mocks.lookupCharacter).toHaveBeenCalledOnce();
    expect(mocks.saveLinkedCharacter).not.toHaveBeenCalled();
  });

  it.each([
    ['in demo mode', { isDemoMode: true }],
    ['outside a guild', { currentGuildId: null }],
  ])('does nothing %s', (_label, state) => {
    useAppStore.setState(state);
    setMyProfile();
    renderHook(() => usePortraitRepair());

    expect(mocks.lookupCharacter).not.toHaveBeenCalled();
  });

  it('does not save over a name changed during the lookup', async () => {
    let finishLookup: (value: typeof FOUND) => void = () => {};
    mocks.lookupCharacter.mockReturnValue(new Promise((resolve) => { finishLookup = resolve; }));
    setMyProfile();
    renderHook(() => usePortraitRepair());
    await waitFor(() => expect(mocks.lookupCharacter).toHaveBeenCalledOnce());

    setMyProfile({ inGameName: 'Newname-Uldum' });
    await act(async () => finishLookup(FOUND));

    expect(mocks.saveLinkedCharacter).not.toHaveBeenCalled();
  });
});
