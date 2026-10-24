import { httpsCallable } from 'firebase/functions';
import { authReady, functions } from '../firebase';
import type { BadGroupReportInput, IssueReportInput } from './types';

// Reports become GitHub issues through the `reportIssue` and `reportBadGroup`
// Cloud Functions. The version is the build's commit, so an issue links the
// code the reporter was running.

const version = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : '';

interface FiledReport {
  issueUrl: string;
  issueNumber: number;
}

/** File a bug report or feature request. Needs a Discord sign-in. */
export async function fileIssueReport({ kind, title, description, reporterName }: IssueReportInput): Promise<void> {
  const call = httpsCallable<Record<string, string>, FiledReport>(functions, 'reportIssue');
  await authReady;
  await call({ kind, title, description, reporterName: reporterName ?? '', version });
}

/** Report that a lobby's current groups look wrong. The function reads the groups itself. */
export async function fileBadGroupReport({ channelId, title, description, reporterName }: BadGroupReportInput): Promise<void> {
  const call = httpsCallable<Record<string, string>, FiledReport>(functions, 'reportBadGroup');
  await authReady;
  await call({ channelId, title, description, reporterName: reporterName ?? '', version });
}
