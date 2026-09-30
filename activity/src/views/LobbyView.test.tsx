import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
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

    const base = 'https://render.worldofwarcraft.com/us/character/area-52/1/2';
    act(() => useAppStore.getState().updateProfile(schmeebs.discordId, { mediaUrl: `${base}-avatar.jpg` }));

    expect(modal.querySelector('.character-stage__img')?.getAttribute('src')).toBe(`${base}-main-raw.png`);
  });

  it("shows another player's character card, headed with their name, in the modal", () => {
    render(<LobbyView onNavigate={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: `Edit ${schmeebs.name} roles` })[0]);
    const modal = screen.getByRole('dialog', { name: `Edit ${schmeebs.name}` });

    const card = within(modal).getByTestId('character-card');
    expect(within(card).getByText(schmeebs.name)).toBeTruthy();
    expect(within(card).queryByText('Your character')).toBeNull();
    expect(within(card).getByRole('switch', { name: 'Sit out' }).getAttribute('aria-checked')).toBe('false');

    act(() => useAppStore.getState().setChannelData({ ...mockChannelData, sittingOut: [schmeebs.discordId] }));
    expect(within(card).getByRole('switch', { name: 'Sit out' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(within(card).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: `Edit ${schmeebs.name}` })).toBeNull();
  });
});
