import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { LobbyView } from './LobbyView';
import { useAppStore } from '../store/store';
import { mockChannelData, mockPlayers, mockProfiles } from '../lib/mockData';

const [quill, schmeebs] = mockPlayers;

beforeEach(() => {
  // jsdom has no matchMedia; the lobby's layout hooks read it.
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: false,
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  useAppStore.setState({ isDemoMode: true });
  const store = useAppStore.getState();
  store.setProfiles(mockProfiles);
  store.setChannelData(mockChannelData);
  store.setIdentity(quill.discordId, quill.name);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useAppStore.getState().resetSession();
});

describe('LobbyView', () => {
  it("keeps another player's edit modal in step with their profile", () => {
    render(<LobbyView onNavigate={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: `Edit ${schmeebs.name} roles` })[0]);
    const modal = screen.getByRole('dialog', { name: `Edit ${schmeebs.name}` });

    const avatar = 'https://render.worldofwarcraft.com/us/character/area-52/1/2-avatar.jpg';
    act(() => useAppStore.getState().updateProfile(schmeebs.discordId, { mediaUrl: avatar }));

    expect(modal.querySelector('.character-header__img')?.getAttribute('src')).toBe(avatar);
  });
});
