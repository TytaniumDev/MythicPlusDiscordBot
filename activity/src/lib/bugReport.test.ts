import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../store/store';
import { bugReportTags, sendBugReport } from './bugReport';
import { Sentry, isSentryReady } from './sentry';

vi.mock('./sentry', () => ({
  isSentryReady: vi.fn(),
  Sentry: { captureFeedback: vi.fn(), flush: vi.fn() },
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe('bugReportTags', () => {
  it('describes what the app was doing', () => {
    const tags = bugReportTags({ ...useAppStore.getState(), currentView: 'lobby', isDemoMode: true });
    expect(tags).toMatchObject({ view: 'lobby', lobbyStatus: 'none', players: 0, demo: true, signedIn: false });
  });
});

describe('sendBugReport', () => {
  it('rejects when Sentry is not set up', async () => {
    vi.mocked(isSentryReady).mockReturnValue(false);
    await expect(sendBugReport({ title: 't', description: 'd' })).rejects.toThrow('Sentry is not set up');
    expect(Sentry.captureFeedback).not.toHaveBeenCalled();
  });

  it('sends the report as feedback with the logs attached', async () => {
    vi.mocked(isSentryReady).mockReturnValue(true);
    vi.mocked(Sentry.flush).mockResolvedValue(true);

    await sendBugReport({ title: 'Wheel froze', description: 'It stopped', reporterName: 'Tyler' });

    const [params, hint] = vi.mocked(Sentry.captureFeedback).mock.calls[0];
    expect(params).toMatchObject({ message: 'Wheel froze\n\nIt stopped', name: 'Tyler' });
    expect(hint?.attachments?.[0]).toMatchObject({ filename: 'console.log', contentType: 'text/plain' });
  });

  it('rejects when the report does not go out in time', async () => {
    vi.mocked(isSentryReady).mockReturnValue(true);
    vi.mocked(Sentry.flush).mockResolvedValue(false);
    await expect(sendBugReport({ title: 't', description: 'd' })).rejects.toThrow('Timed out');
  });
});
