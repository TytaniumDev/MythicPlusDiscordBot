import { useEffect, useRef, useCallback } from 'react';
import { SecondaryButton, PrimaryCTA } from './ui';

interface ConfirmBackDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmBackDialog({ onConfirm, onCancel }: ConfirmBackDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onCancel();
  }, [onCancel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="edit-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="spin-warning" role="alertdialog" aria-label="Confirm going back">
        <div className="spin-warning__icon">&#x26A0;&#xFE0F;</div>
        <h3 className="spin-warning__title">Go Back?</h3>
        <p className="spin-warning__subtitle">
          This will cancel the spin and revert the activity for
          everyone in the session, not just you.
        </p>
        <div className="spin-warning__actions">
          <SecondaryButton onClick={onCancel}>Stay</SecondaryButton>
          <PrimaryCTA id="confirm-back-btn" onClick={onConfirm}>Go Back</PrimaryCTA>
        </div>
      </div>
    </div>
  );
}
