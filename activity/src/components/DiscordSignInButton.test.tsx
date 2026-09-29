import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ signInWithDiscord: vi.fn() }));
vi.mock('../services/discordAuth', () => ({ signInWithDiscord: mocks.signInWithDiscord }));

import { DiscordSignInButton } from './DiscordSignInButton';
import { useAppStore } from '../store/store';
import { demoService } from '../services/demoService';
import { mockChannelData, mockPlayers } from '../lib/mockData';

const gazzi = mockPlayers[4];

beforeEach(() => {
  useAppStore.setState({ isDemoMode: true, discordSignInAvailable: true });
  useAppStore.getState().setChannelData(mockChannelData);
  vi.spyOn(demoService, 'claimPlayer').mockResolvedValue();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.signInWithDiscord.mockReset();
  useAppStore.getState().resetSession();
  useAppStore.setState({ verifiedDiscordId: null, discordSignInAvailable: false });
});

describe('DiscordSignInButton', () => {
  it('renders nothing outside the Discord activity', () => {
    useAppStore.setState({ discordSignInAvailable: false });
    const { container } = render(<DiscordSignInButton />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing once signed in', () => {
    useAppStore.setState({ verifiedDiscordId: gazzi.discordId });
    const { container } = render(<DiscordSignInButton />);
    expect(container.innerHTML).toBe('');
  });

  it('selects the signed-in player and reports success', async () => {
    mocks.signInWithDiscord.mockResolvedValue(gazzi.discordId);
    const onSignedIn = vi.fn();
    render(<DiscordSignInButton onSignedIn={onSignedIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(useAppStore.getState().currentPlayerId).toBe(gazzi.discordId);
    expect(useAppStore.getState().identityResolved).toBe(true);
  });

  it('does not report success when the player is not in the lobby', async () => {
    mocks.signInWithDiscord.mockResolvedValue('999999999999999999');
    const onSignedIn = vi.fn();
    render(<DiscordSignInButton onSignedIn={onSignedIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }));

    await waitFor(() => expect(mocks.signInWithDiscord).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with Discord' })).toHaveProperty('disabled', false));
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentPlayerId).toBeNull();
  });

  it('shows an error when sign-in fails', async () => {
    mocks.signInWithDiscord.mockRejectedValue(new Error('closed'));
    render(<DiscordSignInButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', "Discord sign-in didn't finish. Try again.");
  });
});
