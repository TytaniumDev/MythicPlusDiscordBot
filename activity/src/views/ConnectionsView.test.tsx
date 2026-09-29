import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ConnectionsView } from './ConnectionsView';
import { HeaderProfileSlot } from '../components/HeaderProfileSlot';
import { useAppStore } from '../store/store';

beforeEach(() => {
  useAppStore.setState({ isDemoMode: true, currentView: 'results' });
});

afterEach(() => {
  cleanup();
  useAppStore.getState().resetSession();
  useAppStore.setState({ currentView: 'home', connectionsOpen: false });
});

describe('Connections overlay', () => {
  it('opens from the profile modal without leaving the current view', () => {
    const hashBefore = location.hash;
    render(<HeaderProfileSlot />);

    fireEvent.click(screen.getByRole('button', { name: 'Set up your character' }));
    fireEvent.click(screen.getByRole('button', { name: 'View Connections →' }));

    const s = useAppStore.getState();
    expect(s.connectionsOpen).toBe(true);
    expect(s.currentView).toBe('results');
    expect(location.hash).toBe(hashBefore);
  });

  it('closes from its back button, Escape, and browser back', () => {
    const onClose = vi.fn();
    render(<ConnectionsView onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Connections' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
