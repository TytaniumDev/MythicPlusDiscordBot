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

  it('toggles sit-out through the session service', () => {
    useAppStore.setState({ isDemoMode: true });
    const toggle = vi.spyOn(demoService, 'toggleSitOut').mockResolvedValue();
    render(<MyCharacterCard player={gazzi} isSittingOut={false} collapsible />);

    const sitOut = screen.getByRole('switch', { name: 'Sit out' });
    expect(sitOut.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sitOut);
    expect(toggle).toHaveBeenCalledWith(gazzi.discordId);
  });

  it('reflects the sitting-out state', () => {
    render(<MyCharacterCard player={gazzi} isSittingOut collapsible />);
    expect(screen.getByRole('switch', { name: 'Sitting out' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByText('Sitting out')).toHaveLength(2);
  });

  it('reveal() opens the editor', () => {
    const ref = createRef<MyCharacterCardHandle>();
    render(<MyCharacterCard ref={ref} player={gazzi} isSittingOut={false} collapsible />);
    expect(screen.queryByPlaceholderText('PlayerName-ServerName')).toBeNull();

    act(() => ref.current!.reveal());
    expect(screen.getByPlaceholderText('PlayerName-ServerName')).toBeTruthy();
  });
});
