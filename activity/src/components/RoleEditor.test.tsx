import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('../hooks/useCharacterLookup', () => ({
  useCharacterLookup: () => ({ lookup: mocks.lookup, loading: false }),
}));

import { RoleEditor } from './RoleEditor';
import { useAppStore } from '../store/store';
import { demoService } from '../services/demoService';
import { mockPlayers } from '../lib/mockData';

const gazzi = mockPlayers[4];

async function typeName(value: string) {
  fireEvent.change(screen.getByPlaceholderText('PlayerName-ServerName'), { target: { value } });
  // Past the lookup debounce, then let the lookup settle.
  await act(() => vi.advanceTimersByTimeAsync(800));
}

beforeEach(() => {
  vi.useFakeTimers();
  useAppStore.setState({ isDemoMode: true });
  vi.spyOn(demoService, 'saveRoles').mockResolvedValue();
  vi.spyOn(demoService, 'saveLinkedCharacter').mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  mocks.lookup.mockReset();
  useAppStore.getState().resetSession();
});

describe('RoleEditor name lookup', () => {
  it('says the character was not found when the name does not resolve', async () => {
    mocks.lookup.mockResolvedValue({ status: 'notFound' });
    render(<RoleEditor player={gazzi} />);

    await typeName('Nobody-Uldum');

    expect(screen.getByRole('alert').textContent).toBe('Character not found');
  });

  it('asks for a retry instead of blaming the name when the lookup fails', async () => {
    mocks.lookup.mockResolvedValue({ status: 'failed' });
    render(<RoleEditor player={gazzi} />);

    await typeName('Gazzi-Stormrage');

    expect(screen.getByRole('alert').textContent).toBe("Couldn't look up the character. Try again in a moment.");
    expect(demoService.saveLinkedCharacter).not.toHaveBeenCalled();
  });

  it('saves the character it found', async () => {
    const mediaUrl = 'https://render.worldofwarcraft.com/us/character/stormrage/1/2-avatar.jpg';
    mocks.lookup.mockResolvedValue({
      status: 'found',
      character: { name: 'Gazzi', realm: 'Stormrage', class: 'Druid', role: 'tank', utilities: ['brez'], mediaUrl },
    });
    render(<RoleEditor player={gazzi} />);

    await typeName('Gazzi-Stormrage');

    expect(screen.queryByRole('alert')).toBeNull();
    expect(demoService.saveLinkedCharacter).toHaveBeenCalledWith(
      gazzi.discordId,
      { name: 'Gazzi', realm: 'stormrage', region: 'us' },
      mediaUrl,
      'Druid',
    );
  });
});
