import { useEffect, useRef, useState, useCallback } from 'react';
import { SecondaryButton } from './ui';

interface ReportBadGroupDialogProps {
  onClose: () => void;
  onSubmit: (title: string, description: string) => Promise<void>;
}

export function ReportBadGroupDialog({ onClose, onSubmit }: ReportBadGroupDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current && !submitting) onClose();
  }, [onClose, submitting]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, submitting]);

  const canSubmit = !submitting && title.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(title.trim(), description.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="edit-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="report-dialog" role="dialog" aria-label="Report bad group">
        <h3 className="report-dialog__title">Report Bad Group</h3>
        <p className="report-dialog__subtitle">
          Tell us what looks wrong with this group formation — we'll review it and improve the algorithm.
        </p>
        <input
          type="text"
          placeholder="Issue title"
          aria-label="Issue title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="report-input"
          maxLength={100}
          disabled={submitting}
        />
        <textarea
          placeholder="Describe what's wrong with the group formation"
          aria-label="Issue description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="report-textarea"
          rows={4}
          maxLength={500}
          disabled={submitting}
        />
        <div className="report-dialog__actions">
          <SecondaryButton onClick={onClose} disabled={submitting}>Cancel</SecondaryButton>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
