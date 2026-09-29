import { describe, expect, it, afterEach, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MyCharacterCard, type MyCharacterCardHandle } from './MyCharacterCard';
import { useAppStore } from '../store/store';
import { demoService } from '../services/demoService';
import { mockPlayers } from '../lib/mockData';

const gazzi = mockPlayers[4];

describe('MyCharacterCard', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.getState().resetSession();
  });

  it('shows the character and keeps the editor closed when collapsible and ready', () => {
    render(<MyCharacterCard player={gazzi} isSittingOut={false} collapsible />);
    expect(screen.getByText(gazzi.name)).toBeTruthy();
    expect(screen.getByText(gazzi.inGameName!)).toBeTruthy();
    expect(screen.getByText('✓ Ready')).toBeTruthy();
    expect(screen.queryByPlaceholderText('PlayerName-ServerName')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '✎ Edit' }));
    expect(screen.getByPlaceholderText('PlayerName-ServerName')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('opens the editor straight away when the in-game name is missing', () => {
    render(<MyCharacterCard player={{ ...gazzi, inGameName: undefined }} isSittingOut={false} collapsible />);
    expect(screen.getByText('Not ready')).toBeTruthy();
    expect(screen.getByText('⚠ Add your in-game name')).toBeTruthy();
    expect(screen.getByPlaceholderText('PlayerName-ServerName')).toBeTruthy();
  });

  it('always shows the editor when not collapsible', () => {
    render(<MyCharacterCard player={gazzi} isSittingOut={false} />);
    expect(screen.queryByRole('button', { name: '✎ Edit' })).toBeNull();
    expect(screen.getByPlaceholderText('PlayerName-ServerName')).toBeTruthy();
  });

  it('sits out and rejoins through the session service', () => {
    useAppStore.setState({ isDemoMode: true, currentChannelId: 'channel-1' });
    const setSittingOut = vi.spyOn(demoService, 'setSittingOut').mockResolvedValue();

    render(<MyCharacterCard player={gazzi} isSittingOut={false} collapsible />);
    const sitOut = screen.getByRole('switch', { name: 'Sit out' });
    expect(sitOut.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sitOut);
    expect(setSittingOut).toHaveBeenLastCalledWith('channel-1', gazzi.discordId, true);

    cleanup();
    render(<MyCharacterCard player={gazzi} isSittingOut collapsible />);
    fireEvent.click(screen.getByRole('switch', { name: 'Sitting out' }));
    expect(setSittingOut).toHaveBeenLastCalledWith('channel-1', gazzi.discordId, false);
  });

  it('reflects the sitting-out state', () => {
    render(<MyCharacterCard player={gazzi} isSittingOut collapsible />);
    expect(screen.getByRole('switch', { name: 'Sitting out' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByText('Sitting out')).toHaveLength(2);
  });

  it('shows a portrait saved after the card rendered', () => {
    const { container, rerender } = render(<MyCharacterCard player={{ ...gazzi, mediaUrl: null }} isSittingOut={false} />);
    expect(container.querySelector('.my-character__portrait-img')).toBeNull();

    // e.g. the profile modal's Refresh, or the weekly refresh job.
    const avatar = 'https://render.worldofwarcraft.com/us/character/uldum/1/2-avatar.jpg';
    rerender(<MyCharacterCard player={{ ...gazzi, mediaUrl: avatar }} isSittingOut={false} />);

    expect(container.querySelector('.my-character__portrait-img')?.getAttribute('src')).toBe(avatar);
  });

  it('reveal() opens the editor', () => {
    const ref = createRef<MyCharacterCardHandle>();
    render(<MyCharacterCard ref={ref} player={gazzi} isSittingOut={false} collapsible />);
    expect(screen.queryByPlaceholderText('PlayerName-ServerName')).toBeNull();

    act(() => ref.current!.reveal());
    expect(screen.getByPlaceholderText('PlayerName-ServerName')).toBeTruthy();
  });
});
