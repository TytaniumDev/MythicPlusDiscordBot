import { Sentry, isSentryReady } from './sentry';
import { formatLogs } from './logBuffer';
import { isDiscordEmbedded } from './embedded';
import { useAppStore } from '../store/store';

// Bug reports from the header button go to Sentry User Feedback, with the
// recent console lines attached, so anyone can send one without signing in.

export interface BugReport {
  title: string;
  description: string;
  /** The name the reporter goes by in the lobby. Never a Discord ID. */
  reporterName?: string;
}

/** What the app was doing when the report was sent, as Sentry tags. */
export type BugReportTags = Record<string, string | number | boolean>;

/** The tags for a report, from the app's state. */
export function bugReportTags(state: ReturnType<typeof useAppStore.getState>): BugReportTags {
  return {
    view: state.currentView,
    lobbyStatus: state.channelData?.status ?? 'none',
    players: state.players.length,
    demo: state.isDemoMode,
    connectionLost: state.connectionLost,
    signedIn: state.verifiedDiscordId !== null,
    embedded: isDiscordEmbedded(),
  };
}

const FLUSH_TIMEOUT_MS = 10_000;

/**
 * Send a bug report to Sentry and wait for it to go out. Rejects when Sentry
 * isn't set up (no DSN) or the report couldn't be delivered, so the form can
 * offer a retry.
 */
export async function sendBugReport(report: BugReport): Promise<void> {
  if (!isSentryReady()) throw new Error('Sentry is not set up');

  Sentry.captureFeedback(
    {
      message: `${report.title}\n\n${report.description}`,
      name: report.reporterName || undefined,
      source: 'header-bug-button',
      tags: bugReportTags(useAppStore.getState()),
    },
    {
      attachments: [{ filename: 'console.log', data: formatLogs(), contentType: 'text/plain' }],
    },
  );

  if (!(await Sentry.flush(FLUSH_TIMEOUT_MS))) {
    throw new Error('Timed out sending the bug report');
  }
}
