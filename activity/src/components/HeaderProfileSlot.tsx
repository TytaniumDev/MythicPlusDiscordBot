import { useCallback, useState } from 'react';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileModal } from './ProfileModal';
import { ReportIssueDialog } from './ReportIssueDialog';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useMyProfile } from '../hooks/useMyProfile';
import { reportError } from '../lib/sentry';
import type { IssueKind } from '../services/types';

export function HeaderProfileSlot() {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const setConnectionsOpen = useAppStore((s) => s.setConnectionsOpen);
  const service = useSessionService();
  const { player, displayName } = useMyProfile();

  const submitReport = useCallback(async (kind: IssueKind, title: string, description: string) => {
    try {
      await service.reportIssue({ kind, title, description, reporterName: player?.name || displayName });
    } catch (err) {
      reportError(err, { tag: 'HeaderProfileSlot.reportIssue' });
      throw err;
    }
  }, [service, player, displayName]);

  return (
    <>
      <ProfileAvatar onClick={() => setOpen(true)} />
      <ProfileModal
        open={open}
        onClose={() => setOpen(false)}
        onOpenConnections={() => {
          setOpen(false);
          setConnectionsOpen(true);
        }}
        onOpenReport={() => {
          setOpen(false);
          setReportOpen(true);
        }}
      />
      {reportOpen && (
        <ReportIssueDialog onClose={() => setReportOpen(false)} onSubmit={submitReport} />
      )}
    </>
  );
}
