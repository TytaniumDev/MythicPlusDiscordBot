import { useCallback, useState } from 'react';
import { IconButton } from './ui';
import { ReportDialog } from './ReportDialog';
import { useMyProfile } from '../hooks/useMyProfile';
import { sendBugReport } from '../lib/bugReport';
import { reportError } from '../lib/sentry';

const BugIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 2l1.9 1.9" /><path d="M16 2l-1.9 1.9" />
    <path d="M9 7.1V6a3 3 0 1 1 6 0v1.1" />
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z" />
    <path d="M12 20v-9" />
    <path d="M6.5 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
    <path d="M17.5 9C19.4 8.8 21 7.1 21 5" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
  </svg>
);

/**
 * The header's bug button. Reports go to Sentry with the recent console lines,
 * so no sign-in is needed.
 */
export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const { displayName } = useMyProfile();

  const submit = useCallback(async (title: string, description: string) => {
    try {
      await sendBugReport({ title, description, reporterName: displayName ?? undefined });
    } catch (err) {
      reportError(err, { tag: 'BugReportButton.send' });
      throw err;
    }
  }, [displayName]);

  return (
    <>
      <IconButton icon={<BugIcon />} label="Report a bug" onClick={() => setOpen(true)} />
      {open && (
        <ReportDialog
          heading="Report a Bug"
          subtitle="Your recent logs are sent with it, so we can see what went wrong."
          descriptionPlaceholder="What happened, and what did you expect?"
          onClose={() => setOpen(false)}
          onSubmit={submit}
          sentMessage="Thanks! Your report and logs were sent."
        />
      )}
    </>
  );
}
