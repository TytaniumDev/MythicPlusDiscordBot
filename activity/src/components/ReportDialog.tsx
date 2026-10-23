import { useEffect, useId, useRef, useState, useCallback, type ReactNode } from 'react';
import { SecondaryButton } from './ui';

interface ReportDialogProps {
  heading: string;
  subtitle: string;
  descriptionPlaceholder: string;
  onClose: () => void;
  /** Rejecting keeps the form open with an error so the reporter can retry. */
  onSubmit: (title: string, description: string) => Promise<void>;
  /** Shown in place of the form once the report is sent; without it the caller closes the dialog. */
  sentMessage?: string;
  /** Holds the submit button back, e.g. until the reporter signs in. */
  submitBlocked?: boolean;
  /** Extra content above the fields, such as a report type picker. */
  children?: ReactNode;
}

/** A title-and-description report form in a modal. */
export function ReportDialog({
  heading,
  subtitle,
  descriptionPlaceholder,
  onClose,
  onSubmit,
  sentMessage,
  submitBlocked = false,
  children,
}: ReportDialogProps) {
  const headingId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(false);

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

  const canSubmit = !submitting && !submitBlocked && title.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFailed(false);
    try {
      await onSubmit(title.trim(), description.trim());
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="edit-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="report-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <h3 className="report-dialog__title" id={headingId}>{heading}</h3>
        {sent && sentMessage ? (
          <>
            <p className="report-success" role="status">{sentMessage}</p>
            <div className="report-dialog__actions">
              <SecondaryButton onClick={onClose}>Close</SecondaryButton>
            </div>
          </>
        ) : (
          <>
            <p className="report-dialog__subtitle">{subtitle}</p>
            {children}
            <input
              type="text"
              placeholder="Title"
              aria-label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="report-input"
              maxLength={100}
              disabled={submitting}
            />
            <textarea
              placeholder={descriptionPlaceholder}
              aria-label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="report-textarea"
              rows={4}
              maxLength={1000}
              disabled={submitting}
            />
            {failed && (
              <p className="report-dialog__error" role="alert">Couldn't send the report. Try again.</p>
            )}
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
          </>
        )}
      </div>
    </div>
  );
}
