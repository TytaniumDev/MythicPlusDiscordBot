import { useState } from 'react';
import { ReportDialog } from './ReportDialog';
import { DiscordSignInButton } from './DiscordSignInButton';
import { ToggleButton } from './ui';
import { useAppStore } from '../store/store';
import type { IssueKind } from '../services/types';

interface ReportIssueDialogProps {
  onClose: () => void;
  onSubmit: (kind: IssueKind, title: string, description: string) => Promise<void>;
}

const KINDS: { kind: IssueKind; label: string; heading: string; placeholder: string }[] = [
  { kind: 'bug', label: 'Bug', heading: 'Report a Bug', placeholder: 'What happened, and what did you expect?' },
  { kind: 'feature', label: 'Feature', heading: 'Request a Feature', placeholder: 'What would you like Wheelson to do?' },
];

/**
 * Bug reports and feature requests. Sending one needs a Discord sign-in, so
 * Wheelson can DM the reporter the issue link and again when it's resolved.
 */
export function ReportIssueDialog({ onClose, onSubmit }: ReportIssueDialogProps) {
  const [kind, setKind] = useState<IssueKind>('bug');
  const signedIn = useAppStore((s) => s.verifiedDiscordId !== null);
  const current = KINDS.find((k) => k.kind === kind) ?? KINDS[0];

  return (
    <ReportDialog
      heading={current.heading}
      subtitle="Wheelson will DM you on Discord when it's resolved."
      descriptionPlaceholder={current.placeholder}
      onClose={onClose}
      onSubmit={(title, description) => onSubmit(kind, title, description)}
      sentMessage="Sent! Wheelson has DMed you a link to it."
      submitBlocked={!signedIn}
    >
      <div className="report-dialog__kinds" role="group" aria-label="Report type">
        {KINDS.map((k) => (
          <ToggleButton
            key={k.kind}
            type="button"
            label={k.label}
            active={kind === k.kind}
            activeColor="healer"
            onClick={() => setKind(k.kind)}
          />
        ))}
      </div>
      {!signedIn && (
        <div className="report-dialog__sign-in">
          <p className="report-dialog__subtitle">Sign in with Discord to send a report.</p>
          <DiscordSignInButton />
        </div>
      )}
    </ReportDialog>
  );
}
