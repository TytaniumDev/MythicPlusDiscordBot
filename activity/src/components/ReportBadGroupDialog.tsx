import { ReportDialog } from './ReportDialog';

interface ReportBadGroupDialogProps {
  onClose: () => void;
  onSubmit: (title: string, description: string) => Promise<void>;
}

export function ReportBadGroupDialog({ onClose, onSubmit }: ReportBadGroupDialogProps) {
  return (
    <ReportDialog
      heading="Report Bad Group"
      subtitle="Tell us what looks wrong with this group formation — we'll review it and improve the algorithm."
      descriptionPlaceholder="Describe what's wrong with the group formation"
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
