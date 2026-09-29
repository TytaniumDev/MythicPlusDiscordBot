import { describe, expect, it, afterEach, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MyCharacterCard, type MyCharacterCardHandle } from './MyCharacterCard';
import { useAppStore } from '../store/store';
import { demoService } from '../services/demoService';
import { mockPlayers } from '../lib/mockData';

const gazzi = mockPlayers[4];
const NEEDS_NAME_CAPTION = 'Add your in-game name to show your character';

describe('MyCharacterCard', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.getState().resetSession();
  });

  describe('phone layout (collapsible)', () => {
    it('shows the role tags and keeps the editor closed when ready', () => {
      const { container } = render(<MyCharacterCard player={gazzi} isSittingOut={false} collapsible />);
      expect(screen.getByText('✓ Ready')).toBeTruthy();
      const tags = [...container.querySelectorAll('.chip-tags .role-tag')].map((t) => t.textContent);
      expect(tags).toEqual(['Tank', 'Brez']);
      expect(screen.queryByPlaceholderText('PlayerName-ServerName')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    });

    it('opens the editor from Edit, keeping Edit in place but out of reach', () => {
      render(<MyCharacterCard player={gazzi} isSittingOut={false} collapsible />);
      const edit = screen.getByRole('button', { name: 'Edit' });
      expect(edit.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(edit);
      expect(screen.getByPlaceholderText('PlayerName-ServerName')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Done' }).getAttribute('aria-expanded')).toBe('true');
      // Still rendered so the header keeps its height, but inert.
      expect(edit.isConnected).toBe(true);
      expect(edit.hasAttribute('inert')).toBe(true);
      expect(edit.classList.contains('my-character__edit--reserved')).toBe(true);
    });

    it('closes the editor from Done and puts focus back on Edit', () => {
      render(<MyCharacterCard player={gazzi} isSittingOut={false} collapsible />);
      const edit = screen.getByRole('button', { name: 'Edit' });
      fireEvent.click(edit);

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(screen.queryByPlaceholderText('PlayerName-ServerName')).toBeNull();
      expect(edit.hasAttribute('inert')).toBe(false);
      expect(document.activeElement).toBe(edit);
    });

    it('opens the editor straight away when the in-game name is missing', () => {
      render(<MyCharacterCard player={{ ...gazzi, inGameName: undefined }} isSittingOut={false} collapsible />);
      expect(screen.getByText('Not ready')).toBeTruthy();
      expect(screen.getByPlaceholderText('PlayerName-ServerName')).toBeTruthy();
      // The open name field is the prompt here; no caption over the stage.
      expect(screen.queryByText(NEEDS_NAME_CAPTION)).toBeNull();
    });
  });

  describe('sidebar layout', () => {
    it('always shows the editor, without Edit or role tags', () => {
      const { container } = render(<MyCharacterCard player={gazzi} isSittingOut={false} />);
      expect(screen.getByPlaceholderText('PlayerName-ServerName')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
      expect(container.querySelector('.chip-tags')).toBeNull();
    });

    it('asks for the in-game name over the empty stage', () => {
      render(<MyCharacterCard player={{ ...gazzi, inGameName: undefined, mediaUrl: null }} isSittingOut={false} />);
      expect(screen.getByText('Not ready')).toBeTruthy();
      expect(screen.getByText(NEEDS_NAME_CAPTION)).toBeTruthy();
    });
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
    render(<MyCharacterCard player={gazzi} isSittingOut />);
    fireEvent.click(screen.getByRole('switch', { name: 'Sit out' }));
    expect(setSittingOut).toHaveBeenLastCalledWith('channel-1', gazzi.discordId, false);
  });

  it('reflects the sitting-out state', () => {
    const { container } = render(<MyCharacterCard player={gazzi} isSittingOut collapsible />);
    expect(screen.getByRole('switch', { name: 'Sit out' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Sitting out')).toBeTruthy();
    expect(container.querySelector('.character-stage--dimmed')).not.toBeNull();
  });

  it('shows a render saved after the card rendered', () => {
    const { container, rerender } = render(<MyCharacterCard player={{ ...gazzi, mediaUrl: null }} isSittingOut={false} />);
    expect(container.querySelector('.character-stage__img')).toBeNull();
    expect(container.querySelector('.character-stage__placeholder')).not.toBeNull();

    // e.g. the profile modal's Refresh, or the weekly refresh job.
    const base = 'https://render.worldofwarcraft.com/us/character/uldum/1/2';
    rerender(<MyCharacterCard player={{ ...gazzi, mediaUrl: `${base}-avatar.jpg` }} isSittingOut={false} />);

    const img = screen.getByAltText(`${gazzi.inGameName}, full-body render`);
    expect(img.getAttribute('src')).toBe(`${base}-main-raw.png`);
  });

  it('reveal() opens the editor', () => {
    const ref = createRef<MyCharacterCardHandle>();
    render(<MyCharacterCard ref={ref} player={gazzi} isSittingOut={false} collapsible />);
    expect(screen.queryByPlaceholderText('PlayerName-ServerName')).toBeNull();

    act(() => ref.current!.reveal());
    expect(screen.getByPlaceholderText('PlayerName-ServerName')).toBeTruthy();
  });
});
