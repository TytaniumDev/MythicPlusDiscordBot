import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/discordAuth', () => ({ signInWithDiscord: vi.fn() }));

import { ReportIssueDialog } from './ReportIssueDialog';
import { useAppStore } from '../store/store';

function fillIn() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: ' Dark mode ' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'Please' } });
}

afterEach(() => {
  cleanup();
  useAppStore.setState({ verifiedDiscordId: null, discordSignInAvailable: false });
});

describe('ReportIssueDialog', () => {
  it('asks for a Discord sign-in before it can send', () => {
    useAppStore.setState({ verifiedDiscordId: null, discordSignInAvailable: true });
    render(<ReportIssueDialog onClose={vi.fn()} onSubmit={vi.fn()} />);
    fillIn();

    expect(screen.getByRole('button', { name: 'Sign in with Discord' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Submit Report' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends the chosen kind with the trimmed text, then confirms', async () => {
    useAppStore.setState({ verifiedDiscordId: '100000000000000099' });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReportIssueDialog onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Feature' }));
    expect(screen.getByRole('dialog', { name: 'Request a Feature' })).toBeTruthy();
    fillIn();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Sent!'));
    expect(onSubmit).toHaveBeenCalledWith('feature', 'Dark mode', 'Please');
  });

  it('keeps the form open with an error when sending fails', async () => {
    useAppStore.setState({ verifiedDiscordId: '100000000000000099' });
    render(<ReportIssueDialog onClose={vi.fn()} onSubmit={vi.fn().mockRejectedValue(new Error('down'))} />);
    fillIn();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain("Couldn't send"));
    expect((screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).value).toBe(' Dark mode ');
  });
});
